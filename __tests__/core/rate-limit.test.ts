import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB } from '@/lib/core/db';
import { consume, rateLimitHeaders } from '@/lib/core/rate-limit';
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

  it('retries a duplicate-key first write and preserves the bucket count', async () => {
    const original = RateLimitBucket.findOneAndUpdate.bind(RateLimitBucket);
    const findOneAndUpdate = vi.spyOn(RateLimitBucket, 'findOneAndUpdate');
    findOneAndUpdate.mockImplementationOnce(() => ({ lean: () => Promise.reject({ code: 11000 }) }) as never);
    findOneAndUpdate.mockImplementation((...args) => original(...args));

    const result = await consume({ scope: 'duplicate-key', identifier: 'owner-hash' }, 2, 60);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ allowed: true, remaining: 1 });
    expect(await RateLimitBucket.findOne({ scope: 'duplicate-key', identifier: 'owner-hash' }).lean()).toMatchObject({ count: 1 });
    findOneAndUpdate.mockRestore();
  });

  it('reconnects after mongoose disconnects instead of returning a stale cached client', async () => {
    await connectDB();
    await mongoose.disconnect();

    const reconnected = await connectDB();
    expect(reconnected.connection.readyState).toBe(1);
    await expect(reconnected.connection.db?.admin().ping()).resolves.toEqual({ ok: 1 });
  });

  it('returns standard HTTP headers for allowed and blocked results', () => {
    expect(rateLimitHeaders({ remaining: 4, retryAfterSeconds: 19 })).toEqual({ 'x-ratelimit-remaining': '4' });
    expect(rateLimitHeaders({ remaining: 0, retryAfterSeconds: 19 })).toEqual({ 'x-ratelimit-remaining': '0', 'retry-after': '19' });
    expect(rateLimitHeaders({ remaining: 0, retryAfterSeconds: null })).toEqual({ 'x-ratelimit-remaining': '0' });
  });
});
