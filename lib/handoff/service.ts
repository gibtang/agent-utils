import { randomBytes } from 'node:crypto';
import { connectDB } from '@/lib/core/db';
import { Errors } from '@/lib/core/errors';
import Handoff from '@/models/Handoff';
import {
  decryptHandoffValues, encryptHandoffValues, generateHandoffSubmitToken,
  generateHandoffViewToken, getOrCreateAccountDek, hashHandoffToken,
} from './crypto';
import { createHandoffInputSchema, type HandoffFieldSchema } from './schemas';

export type ConnectionActor = { connectionId: string; agentId: string; accountId: string; plan?: string };
export type OwnerActor = { accountId: string };
export type HandoffField = HandoffFieldSchema;
type Clock = { now?: Date };
type CreateResult = { handoffId: string; viewToken: string; submitToken: string; linkExpiresAt: Date; callbackSecret?: string };
const DAY = 24 * 60 * 60_000;
const PURGE = 30 * DAY;
const erasure = { ciphertext: null, iv: null, tag: null, viewTokenHash: null, submitTokenHash: null };
const at = (opts?: Clock) => opts?.now ?? new Date();

function validateValues(fields: HandoffFieldSchema[], values: Record<string, string>): void {
  const names = fields.map((field) => field.name);
  if (Object.keys(values).length !== names.length || Object.keys(values).some((key) => !names.includes(key))) throw Errors.validationFailed();
  for (const field of fields) {
    const value = values[field.name];
    if (typeof value !== 'string' || value.length > 4096 || (field.required && value.length === 0)) throw Errors.validationFailed();
    if (field.type === 'email' && value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw Errors.validationFailed();
  }
}

export async function createHandoff(actor: ConnectionActor, input: { fieldSchema: HandoffField[]; title?: string; linkTtlHours?: number; callbackUrl?: string }, opts: Clock = {}): Promise<CreateResult> {
  const parsed = createHandoffInputSchema.safeParse(input);
  if (!parsed.success) throw Errors.validationFailed();
  const now = at(opts); const linkExpiresAt = new Date(now.getTime() + parsed.data.linkTtlHours * 3600_000);
  const viewToken = generateHandoffViewToken(); const submitToken = generateHandoffSubmitToken();
  const callbackSecret = parsed.data.callbackUrl ? randomBytes(32).toString('hex') : undefined;
  await connectDB(); await getOrCreateAccountDek(actor.accountId);
  const handoff = await Handoff.create({
    accountId: actor.accountId, agentId: actor.agentId, connectionId: actor.connectionId,
    fieldSchema: parsed.data.fieldSchema, title: parsed.data.title ?? null,
    viewTokenHash: hashHandoffToken(viewToken), submitTokenHash: hashHandoffToken(submitToken),
    linkExpiresAt, sessionExpiresAt: new Date(now.getTime() + DAY), expiresAtPurge: new Date(now.getTime() + PURGE),
    callbackUrl: parsed.data.callbackUrl ?? null, callbackSecretHash: callbackSecret ? hashHandoffToken(callbackSecret) : null,
  });
  return { handoffId: handoff.handoffId, viewToken, submitToken, linkExpiresAt, ...(callbackSecret ? { callbackSecret } : {}) };
}

export async function submitHandoffValues(plaintextSubmitToken: string, values: Record<string, string>, opts: Clock & { ipHash?: string } = {}): Promise<{ handoffId: string; status: 'submitted' }> {
  const now = at(opts); const submitTokenHash = hashHandoffToken(plaintextSubmitToken); await connectDB();
  const candidate = await Handoff.findOne({ submitTokenHash, status: 'awaiting', linkExpiresAt: { $gt: now } }).lean();
  if (!candidate) throw Errors.notFound();
  validateValues(candidate.fieldSchema as HandoffFieldSchema[], values);
  const dek = await getOrCreateAccountDek(candidate.accountId);
  const envelope = encryptHandoffValues(dek, values);
  const handoff = await Handoff.findOneAndUpdate(
    { submitTokenHash, status: 'awaiting', linkExpiresAt: { $gt: now } },
    { $set: { status: 'submitted', ...envelope, submittedAt: now, sessionExpiresAt: new Date(now.getTime() + DAY), submitIpHash: opts.ipHash ?? null } },
    { returnDocument: 'after' },
  ).lean();
  if (!handoff) throw Errors.notFound();
  return { handoffId: handoff.handoffId, status: 'submitted' };
}

export async function decryptHandoff(handoffId: string, actor: ConnectionActor, opts: Clock = {}): Promise<Record<string, string>> {
  const now = at(opts); await connectDB();
  const handoff = await Handoff.findOne({ handoffId, accountId: actor.accountId, connectionId: actor.connectionId }).lean();
  if (!handoff || handoff.status === 'awaiting') throw Errors.notFound();
  if (handoff.status === 'closed') throw Errors.resourceDeleted();
  if (handoff.status === 'expired' || handoff.sessionExpiresAt < now) throw Errors.resourceExpired();
  if (!handoff.ciphertext || !handoff.iv || !handoff.tag) throw Errors.resourceDeleted();
  const dek = await getOrCreateAccountDek(actor.accountId);
  const values = decryptHandoffValues(dek, { ciphertext: handoff.ciphertext, iv: handoff.iv, tag: handoff.tag });
  await Handoff.updateOne({ handoffId, accountId: actor.accountId, connectionId: actor.connectionId, status: 'submitted' }, { $inc: { retrievalCount: 1 }, $set: { lastRetrievedAt: now } });
  return values;
}

export async function closeHandoff(handoffId: string, actor: ConnectionActor | OwnerActor, reason: 'done' | 'revoked', opts: Clock = {}): Promise<void> {
  const now = at(opts); await connectDB();
  const creator = 'connectionId' in actor;
  if (reason === 'done' && !creator) throw Errors.permissionDenied();
  const filter: Record<string, unknown> = { handoffId, accountId: actor.accountId };
  if (creator) filter.connectionId = actor.connectionId;
  const existing = await Handoff.findOne(filter).lean();
  if (!existing) throw Errors.notFound();
  if (existing.status === 'closed' || existing.status === 'expired') throw Errors.resourceDeleted();
  await Handoff.updateOne(filter, { $set: { status: 'closed', closureReason: reason, ...erasure, closedAt: now, expiresAtPurge: new Date(now.getTime() + PURGE) } });
}

export async function expireStaleHandoffs(opts: Clock = {}): Promise<number> {
  const now = at(opts); await connectDB(); const purge = new Date(now.getTime() + PURGE);
  const [submitted, awaiting] = await Promise.all([
    Handoff.updateMany({ status: 'submitted', sessionExpiresAt: { $lt: now } }, { $set: { status: 'expired', ...erasure, expiresAtPurge: purge } }),
    Handoff.updateMany({ status: 'awaiting', linkExpiresAt: { $lt: now } }, { $set: { status: 'expired', ...erasure, expiresAtPurge: purge } }),
  ]);
  return submitted.modifiedCount + awaiting.modifiedCount;
}

export async function listHandoffs(actor: OwnerActor, opts: Clock = {}): Promise<Array<{ handoffId: string; title: string | null; status: string; closureReason: string | null; createdAt: Date; agentId: string; retrievalCount: number; lastRetrievedAt: Date | null; linkExpiresAt: Date; sessionExpiresAt: Date }>> {
  void opts;
  await connectDB();
  const rows = await Handoff.find({ accountId: actor.accountId }).select({ handoffId: 1, title: 1, status: 1, closureReason: 1, createdAt: 1, agentId: 1, retrievalCount: 1, lastRetrievedAt: 1, linkExpiresAt: 1, sessionExpiresAt: 1, _id: 0 }).lean();
  return rows.map((row) => ({ handoffId: row.handoffId, title: row.title ?? null, status: row.status, closureReason: row.closureReason ?? null, createdAt: row.createdAt, agentId: row.agentId, retrievalCount: row.retrievalCount, lastRetrievedAt: row.lastRetrievedAt ?? null, linkExpiresAt: row.linkExpiresAt, sessionExpiresAt: row.sessionExpiresAt }));
}
