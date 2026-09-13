import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, hashSecret, issueSecret, safeEqualText } from '@/lib/core/secrets';
import { resetConfigCacheForTests } from '@/lib/core/config';

const pepper = 'test-pepper-is-at-least-sixteen-characters';
const key = 'test-encryption-key-is-at-least-sixteen-chars';

describe('core secrets', () => {
  beforeEach(() => {
    process.env.CREDENTIAL_HASH_PEPPER = pepper;
    process.env.SECRET_ENCRYPTION_KEY = key;
    resetConfigCacheForTests();
  });
  afterEach(() => resetConfigCacheForTests());

  it('issues prefixed secrets with at least 256 bits of random material', () => {
    const issued = issueSecret('au_conn_');
    expect(issued.plaintext).toMatch(/^au_conn_[A-Za-z0-9_-]+$/);
    expect(Buffer.from(issued.plaintext.slice(8), 'base64url')).toHaveLength(32);
    expect(issued.hash).toBe(hashSecret(issued.plaintext));
    expect(issued.prefix).toBe('au_conn_');
  });

  it('uses the configured pepper for deterministic HMAC hashes', () => {
    const first = hashSecret('au_conn_secret');
    expect(first).toBe(hashSecret('au_conn_secret'));
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('au_conn_secret');
    process.env.CREDENTIAL_HASH_PEPPER = 'different-pepper-is-at-least-sixteen-chars';
    resetConfigCacheForTests();
    expect(hashSecret('au_conn_secret')).not.toBe(first);
  });

  it('encrypts and decrypts without exposing plaintext', () => {
    const plaintext = 'au_pair_this-is-private';
    const ciphertext = encryptSecret(plaintext);
    expect(ciphertext).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it('rejects tampered ciphertext and a different encryption key', () => {
    const ciphertext = encryptSecret('private-value');
    const tampered = `${ciphertext.slice(0, -1)}${ciphertext.endsWith('A') ? 'B' : 'A'}`;
    expect(() => decryptSecret(tampered)).toThrow();
    process.env.SECRET_ENCRYPTION_KEY = 'different-encryption-key-at-least-16-chars';
    resetConfigCacheForTests();
    expect(() => decryptSecret(ciphertext)).toThrow();
  });

  it('compares text safely including unequal lengths', () => {
    expect(safeEqualText('abc', 'abc')).toBe(true);
    expect(safeEqualText('abc', 'abd')).toBe(false);
    expect(safeEqualText('abc', 'longer')).toBe(false);
  });
});
