import { connectDB } from '@/lib/core/db';
import { Errors } from '@/lib/core/errors';
import { resourceId } from '@/lib/core/ids';
import { consume, RATE_LIMIT_POLICIES } from '@/lib/core/rate-limit';
import { hashSecret, issueSecret } from '@/lib/core/secrets';
import { planFor, type PlanName } from '@/lib/billing/plans';
import { agentNameSchema, createPairingCodeSchema, createAgentSchema, redeemPairingCodeSchema, renameAgentSchema } from './schemas';
import Account from '@/models/Account';
import Agent from '@/models/Agent';
import Connection from '@/models/Connection';
import PairingCode from '@/models/PairingCode';

export type AgentView = { agentId: string; accountId: string; name: string; status: string; createdAt: Date };
export type ConnectionView = { connectionId: string; agentId: string; accountId: string; status: string; runtime: string | null; displayPrefix: string; createdAt: Date };
export type ConnectionActor = { connectionId: string; agentId: string; accountId: string; plan: PlanName };
export type ConnectionStatusView = { agentName: string; connection: ConnectionView; plan: PlanName; capabilities: string[] };
const INVALID_PAIRING = () => Errors.notFound({ message: 'The requested resource was not found.' });

function agentView(agent: { agentId: string; accountId: string; name: string; status: string; createdAt: Date }): AgentView { return { agentId: agent.agentId, accountId: agent.accountId, name: agent.name, status: agent.status, createdAt: agent.createdAt }; }
function connectionView(connection: { connectionId: string; agentId: string; accountId: string; status: string; runtime?: string | null; displayPrefix: string; createdAt: Date }): ConnectionView { return { connectionId: connection.connectionId, agentId: connection.agentId, accountId: connection.accountId, status: connection.status, runtime: connection.runtime ?? null, displayPrefix: connection.displayPrefix, createdAt: connection.createdAt }; }
function validation(input: unknown, schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown } }): unknown { const parsed = schema.safeParse(input); if (!parsed.success) throw Errors.validationFailed(); return parsed.data; }

/** Agents are free; plan connection capacity is deliberately charged only at code redemption. */
export async function createAgent(owner: { accountId: string }, input: { name: string }): Promise<AgentView> {
  const parsed = validation(input, createAgentSchema) as { name: string };
  await connectDB();
  try { const agent = await Agent.create({ accountId: owner.accountId, name: parsed.name }); return agentView(agent); }
  catch (error: unknown) { if (typeof error === 'object' && error && 'code' in error && error.code === 11000) throw Errors.validationFailed({ message: 'name already exists' }); throw error; }
}
export async function renameAgent(owner: { accountId: string }, agentId: string, input: { name: string }): Promise<AgentView> {
  const parsed = validation(input, renameAgentSchema) as { name: string };
  await connectDB();
  try { const agent = await Agent.findOneAndUpdate({ accountId: owner.accountId, agentId, status: { $ne: 'deleted' } }, { $set: { name: parsed.name } }, { returnDocument: 'after' }); if (!agent) throw Errors.notFound(); return agentView(agent); }
  catch (error: unknown) { if (typeof error === 'object' && error && 'code' in error && error.code === 11000) throw Errors.validationFailed({ message: 'name already exists' }); throw error; }
}
export async function createPairingCode(owner: { accountId: string }, agentId: string, input: { runtime?: string }, opts: { now?: Date } = {}): Promise<{ code: string; expiresAt: Date }> {
  const parsed = validation(input, createPairingCodeSchema) as { runtime?: string };
  const rate = await consume({ scope: 'pairing_create', identifier: owner.accountId }, RATE_LIMIT_POLICIES.PAIRING_CREATE.limit, RATE_LIMIT_POLICIES.PAIRING_CREATE.windowSeconds, opts.now);
  if (!rate.allowed) throw Errors.planLimitReached();
  await connectDB();
  if (!await Agent.exists({ accountId: owner.accountId, agentId, status: { $ne: 'deleted' } })) throw Errors.notFound();
  const issued = issueSecret('au_pair_'); const now = opts.now ?? new Date(); const expiresAt = new Date(now.getTime() + 10 * 60_000);
  await PairingCode.create({ accountId: owner.accountId, agentId, codeHash: issued.hash, runtimeHint: parsed.runtime ?? null, expiresAt });
  return { code: issued.plaintext, expiresAt };
}
/** Atomically claims the code before creating a connection. If capacity is full, the claim is released so a code remains usable after upgrade/revoke. */
export async function redeemPairingCode(input: { code: string; runtimeVersion?: string }, opts: { now?: Date } = {}): Promise<{ connection: ConnectionView; credential: string }> {
  const parsed = validation(input, redeemPairingCodeSchema) as { code: string; runtimeVersion?: string }; const now = opts.now ?? new Date(); const codeHash = hashSecret(parsed.code); const connectionId = resourceId('conn_');
  await connectDB();
  const pairing = await PairingCode.findOneAndUpdate({ codeHash, redeemedAt: null, expiresAt: { $gt: now } }, { $set: { redeemedAt: now, redemptionConnectionId: connectionId } }, { returnDocument: 'after' }).lean();
  if (!pairing) throw INVALID_PAIRING();
  try {
    const account = await Account.findOne({ accountId: pairing.accountId }).lean();
    const agent = await Agent.findOne({ accountId: pairing.accountId, agentId: pairing.agentId, status: 'active' }).lean();
    if (!account || account.status !== 'active' || !agent) throw INVALID_PAIRING();
    const active = await Connection.countDocuments({ accountId: pairing.accountId, status: { $in: ['active', 'needs_attention'] } });
    if (active >= planFor(account.plan).connections) throw Errors.planLimitReached();
    const issued = issueSecret('au_conn_');
    const connection = await Connection.create({ connectionId, accountId: pairing.accountId, agentId: pairing.agentId, credentialHash: issued.hash, displayPrefix: issued.plaintext.slice(0, 12), runtime: parsed.runtimeVersion ?? pairing.runtimeHint ?? null });
    return { connection: connectionView(connection), credential: issued.plaintext };
  } catch (error) {
    await PairingCode.updateOne({ codeHash, redemptionConnectionId: connectionId }, { $set: { redeemedAt: null, redemptionConnectionId: null } });
    throw error;
  }
}
export async function authenticateConnection(bearerToken: string, opts: { now?: Date } = {}): Promise<ConnectionActor> {
  if (!/^au_conn_[A-Za-z0-9_-]+$/.test(bearerToken)) throw Errors.authenticationRequired();
  await connectDB(); const connection = await Connection.findOne({ credentialHash: hashSecret(bearerToken) }).lean();
  if (!connection) throw Errors.authenticationRequired();
  if (connection.status === 'revoked') throw Errors.connectionRevoked();
  if (connection.status !== 'active') throw Errors.permissionDenied();
  const account = await Account.findOne({ accountId: connection.accountId }).lean();
  if (!account || account.status !== 'active') throw Errors.permissionDenied();
  void Connection.updateOne({ connectionId: connection.connectionId }, { $set: { lastActivityAt: opts.now ?? new Date() } });
  return { connectionId: connection.connectionId, agentId: connection.agentId, accountId: connection.accountId, plan: account.plan };
}
export async function getConnectionStatus(actor: ConnectionActor): Promise<ConnectionStatusView> {
  await connectDB(); const [connection, agent] = await Promise.all([Connection.findOne({ connectionId: actor.connectionId, accountId: actor.accountId }).lean(), Agent.findOne({ agentId: actor.agentId, accountId: actor.accountId }).lean()]);
  if (!connection || !agent) throw Errors.notFound(); return { agentName: agent.name, connection: connectionView(connection), plan: actor.plan, capabilities: ['inbox', 'state', 'files'] };
}
/** Return the owner's connections without exposing credential material. */
export async function listConnections(owner: { accountId: string }): Promise<ConnectionView[]> {
  await connectDB();
  const connections = await Connection.find({ accountId: owner.accountId })
    .sort({ createdAt: 1 })
    .lean();
  return connections.map(connectionView);
}
/** Revocation is idempotent for a connection owned by the caller; cross-account ids stay uniformly not found. */
export async function revokeConnection(owner: { accountId: string }, connectionId: string): Promise<void> {
  await connectDB(); const result = await Connection.updateOne({ accountId: owner.accountId, connectionId }, { $set: { status: 'revoked', revokedAt: new Date() } }); if (!result.matchedCount) throw Errors.notFound();
}
export { agentNameSchema };
