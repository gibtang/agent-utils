import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { consume } from '@/lib/core/rate-limit';
import RateLimitBucket from '@/models/RateLimitBucket';
import { resetConfigCacheForTests } from '@/lib/core/config';

let server: MongoMemoryServer;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
});
afterEach(async () => {
  await RateLimitBucket.deleteMany({});
});
afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('core Mongo rate limits', () => {
  it('allows up to the limit, then returns retry timing', async () => {
    const now = new Date('2026-01-01T00:00:10.000Z');
    for (let n = 0; n < 3; n++) expect((await consume({ scope: 'connection', identifier: 'account-hash' }, 3, 60, now)).allowed).toBe(true);
    const rejected = await consume({ scope: 'connection', identifier: 'account-hash' }, 3, 60, now);
    expect(rejected).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 50 });
  });

  it('atomically permits exactly the limit under parallel load', async () => {
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => consume({ scope: 'owner', identifier: 'owner-hash' }, 5, 60)));
    expect(outcomes.filter((result) => result.allowed)).toHaveLength(5);
    expect(outcomes.filter((result) => !result.allowed)).toHaveLength(3);
  });

  it('resets when entering a later window', async () => {
    const key = { scope: 'pairing', identifier: 'code-hash' };
    expect((await consume(key, 1, 60, new Date('2026-01-01T00:00:59Z'))).allowed).toBe(true);
    expect((await consume(key, 1, 60, new Date('2026-01-01T00:01:00Z'))).allowed).toBe(true);
  });
});
