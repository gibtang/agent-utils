import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getServerConfig } from './config';

export type IssuedSecret = { plaintext: string; hash: string; prefix: string };
type SecretPrefix = 'au_conn_' | 'au_pair_' | 'au_hook_' | 'au_link_';

function encryptionKey(): Buffer {
  return createHash('sha256').update(getServerConfig().secretEncryptionKey, 'utf8').digest();
}

export function hashSecret(plaintext: string): string {
  return createHmac('sha256', getServerConfig().credentialHashPepper).update(plaintext, 'utf8').digest('hex');
}

export function issueSecret(prefix: SecretPrefix): IssuedSecret {
  const plaintext = `${prefix}${randomBytes(32).toString('base64url')}`;
  return { plaintext, hash: hashSecret(plaintext), prefix };
}

/** AES-256-GCM ciphertext encoded as version:iv:tag:ciphertext (base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSecret(ciphertext: string): string {
  const [version, ivText, tagText, bodyText, ...extra] = ciphertext.split(':');
  if (version !== 'v1' || !ivText || !tagText || !bodyText || extra.length > 0) throw new Error('Invalid encrypted secret format');
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(bodyText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Unable to decrypt secret');
  }
}

/** Constant-time equality, including inputs with unequal byte lengths. */
export function safeEqualText(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftDigest, rightDigest) && left.length === right.length;
}
