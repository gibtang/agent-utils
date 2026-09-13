import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { connectDB } from '@/lib/core/db';
import Account from '@/models/Account';

export type HandoffValuesEnvelope = { ciphertext: string; iv: string; tag: string };

/** Generates the account-local AES-256-GCM data-encryption key as 32 random bytes of hex. */
export async function generateHandoffDek(): Promise<string> {
  return randomBytes(32).toString('hex');
}

/**
 * Returns the account's handoff DEK, creating it atomically on first use.
 * The null filter prevents concurrent first callers from replacing an already-set key.
 */
export async function getOrCreateAccountDek(accountId: string): Promise<string> {
  await connectDB();
  const generated = await generateHandoffDek();
  const updated = await Account.findOneAndUpdate(
    { accountId, handoffDek: null },
    { $set: { handoffDek: generated } },
    { returnDocument: 'after' },
  );
  if (updated?.handoffDek) return updated.handoffDek;

  const account = await Account.findOne({ accountId }).select({ handoffDek: 1 }).lean();
  if (!account?.handoffDek) throw new Error('Account not found while creating handoff DEK');
  return account.handoffDek;
}

export function generateHandoffViewToken(): string {
  return `htv_${randomBytes(32).toString('base64url')}`;
}

export function generateHandoffSubmitToken(): string {
  return `hts_${randomBytes(32).toString('base64url')}`;
}

/**
 * SHA-256 is intentionally unpeppered: these externally-issued tokens contain
 * 256 bits of entropy, and a deterministic hash enables indexed public lookup.
 */
export function hashHandoffToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function handoffKey(dekHex: string): Buffer {
  const key = Buffer.from(dekHex, 'hex');
  if (!/^[0-9a-f]{64}$/i.test(dekHex) || key.length !== 32) throw new Error('Invalid handoff DEK');
  return key;
}

export function encryptHandoffValues(dekHex: string, values: Record<string, string>): HandoffValuesEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', handoffKey(dekHex), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptHandoffValues(dekHex: string, envelope: HandoffValuesEnvelope): Record<string, string> {
  const decipher = createDecipheriv('aes-256-gcm', handoffKey(dekHex), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as Record<string, string>;
}
