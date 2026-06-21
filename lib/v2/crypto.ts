/**
 * AgentUtils v2 — crypto helpers (key hashing + HMAC signing).
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto';

/** SHA-256 hex digest of a key string. */
export function hashKey(fullKey: string): string {
  return createHash('sha256').update(fullKey).digest('hex');
}

/** Constant-time comparison of two equal-length hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/** Random hex secret for per-tenant callback signing. */
export function randomSecret(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  (globalThis as { crypto: Crypto }).crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HMAC-SHA256 signature for an outbound callback (PRD §6.1).
 * Base string: `<timestamp>.<rawRequestBody>`.
 * Returns `v1=<hex>`.
 */
export function signCallback(secret: string, timestamp: string, rawBody: string): string {
  const base = `${timestamp}.${rawBody}`;
  const mac = createHmac('sha256', secret).update(base).digest('hex');
  return `v1=${mac}`;
}

/** Verify a receiver-supplied signature header against expected. */
export function verifySignature(secret: string, timestamp: string, rawBody: string, signatureHeader: string): boolean {
  const expected = signCallback(secret, timestamp, rawBody);
  if (typeof signatureHeader !== 'string' || signatureHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}
