import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import Account from '@/models/Account';
import Handoff from '@/models/Handoff';
import {
  decryptHandoffValues,
  encryptHandoffValues,
  generateHandoffDek,
  generateHandoffSubmitToken,
  generateHandoffViewToken,
  getOrCreateAccountDek,
  hashHandoffToken,
} from '@/lib/handoff/crypto';
import { handoffFieldSchemaArraySchema } from '@/lib/handoff/schemas';

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
  await connectDB();
  await Promise.all([Account.createIndexes(), Handoff.createIndexes()]);
});

afterEach(async () => {
  await Promise.all([Account.deleteMany({}), Handoff.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('handoff field schema', () => {
  const field = { name: 'api_key', label: 'API key', type: 'password' as const, required: true };

  it('rejects unsupported field type otp', () => {
    expect(handoffFieldSchemaArraySchema.safeParse([{ ...field, type: 'otp' }]).success).toBe(false);
  });

  it('rejects password prefill', () => {
    expect(handoffFieldSchemaArraySchema.safeParse([{ ...field, prefill: 'secret' }]).success).toBe(false);
  });

  it('rejects more than 12 fields', () => {
    expect(handoffFieldSchemaArraySchema.safeParse(Array.from({ length: 13 }, (_, index) => ({ ...field, name: `field_${index}` }))).success).toBe(false);
  });

  it('rejects duplicate field names', () => {
    expect(handoffFieldSchemaArraySchema.safeParse([field, { ...field, label: 'Again' }]).success).toBe(false);
  });

  it('rejects invalid field-name character sets', () => {
    expect(handoffFieldSchemaArraySchema.safeParse([{ ...field, name: 'API Key!' }]).success).toBe(false);
  });
});

describe('Handoff model', () => {
  it('defines token, listing, and purge indexes', () => {
    const indexes = Handoff.schema.indexes();
    expect(indexes).toContainEqual([{ viewTokenHash: 1 }, { unique: true, partialFilterExpression: { viewTokenHash: { $type: 'string' } } }]);
    expect(indexes).toContainEqual([{ submitTokenHash: 1 }, { unique: true, partialFilterExpression: { submitTokenHash: { $type: 'string' } } }]);
    expect(indexes).toContainEqual([{ accountId: 1, status: 1 }, {}]);
    expect(indexes).toContainEqual([{ expiresAtPurge: 1 }, { expireAfterSeconds: 0 }]);
  });

  it('generates cv_ handoff IDs', () => {
    const handoff = new Handoff({
      accountId: 'acct_test', agentId: 'agt_test', connectionId: 'conn_test',
      fieldSchema: [{ name: 'email', label: 'Email', type: 'email', required: true }],
      viewTokenHash: 'view', submitTokenHash: 'submit', linkExpiresAt: new Date(), sessionExpiresAt: new Date(), expiresAtPurge: new Date(),
    });
    expect(handoff.handoffId).toMatch(/^cv_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('also validates field type and password prefill at the model boundary', async () => {
    const invalid = new Handoff({
      accountId: 'acct_test', agentId: 'agt_test', connectionId: 'conn_test',
      fieldSchema: [{ name: 'password', label: 'Password', type: 'otp', required: true, prefill: 'not allowed' }],
      viewTokenHash: 'view', submitTokenHash: 'submit', linkExpiresAt: new Date(), sessionExpiresAt: new Date(), expiresAtPurge: new Date(),
    });
    await expect(invalid.validate()).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
  });
});

describe('handoff crypto', () => {
  it('generates a 32-byte hexadecimal DEK', async () => {
    await expect(generateHandoffDek()).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('round-trips values and uses a fresh IV every encryption', async () => {
    const dek = await generateHandoffDek();
    const values = { email: 'a@example.com', token: 'exact value' };
    const first = encryptHandoffValues(dek, values);
    const second = encryptHandoffValues(dek, values);
    expect(decryptHandoffValues(dek, first)).toEqual(values);
    expect(second).not.toEqual(first);
    expect(second.iv).not.toBe(first.iv);
  });

  it('throws without returning plaintext for ciphertext, IV, tag, and DEK tampering', async () => {
    const dek = await generateHandoffDek();
    const envelope = encryptHandoffValues(dek, { password: 'do-not-return' });
    const flip = (encoded: string) => {
      const bytes = Buffer.from(encoded, 'base64');
      bytes[Math.floor(bytes.length / 2)] ^= 1;
      return bytes.toString('base64');
    };
    expect(() => decryptHandoffValues(dek, { ...envelope, ciphertext: flip(envelope.ciphertext) })).toThrow();
    expect(() => decryptHandoffValues(dek, { ...envelope, iv: flip(envelope.iv) })).toThrow();
    expect(() => decryptHandoffValues(dek, { ...envelope, tag: flip(envelope.tag) })).toThrow();
    const wrongDek = await generateHandoffDek();
    expect(() => decryptHandoffValues(wrongDek, envelope)).toThrow();
  });

  it('generates unique high-entropy view and submit tokens', () => {
    const viewTokens = Array.from({ length: 1000 }, generateHandoffViewToken);
    const submitTokens = Array.from({ length: 1000 }, generateHandoffSubmitToken);
    expect(new Set(viewTokens)).toHaveLength(1000);
    expect(new Set(submitTokens)).toHaveLength(1000);
    expect(viewTokens.every((token) => /^htv_[A-Za-z0-9_-]{43}$/.test(token))).toBe(true);
    expect(submitTokens.every((token) => /^hts_[A-Za-z0-9_-]{43}$/.test(token))).toBe(true);
  });

  it('hashes tokens deterministically and distinctly', () => {
    const first = generateHandoffViewToken();
    const second = generateHandoffViewToken();
    expect(hashHandoffToken(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashHandoffToken(first)).toBe(hashHandoffToken(first));
    expect(hashHandoffToken(first)).not.toBe(hashHandoffToken(second));
  });

  it('creates an account DEK once and reuses it', async () => {
    const account = await provisionAccount({ uid: 'dek-account', email: null, displayName: null, photoURL: null });
    const first = await getOrCreateAccountDek(account.accountId);
    const second = await getOrCreateAccountDek(account.accountId);
    expect(second).toBe(first);
    expect(await Account.countDocuments({ accountId: account.accountId })).toBe(1);
    expect((await Account.findOne({ accountId: account.accountId }).lean())?.handoffDek).toBe(first);
  });
});
