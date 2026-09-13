import { connectDB } from './db';
import RateLimitBucket from '@/models/RateLimitBucket';

export const RATE_LIMIT_POLICIES = {
  OWNER: { limit: 120, windowSeconds: 60 },
  CONNECTION: { limit: 300, windowSeconds: 60 },
  CONNECTION_PER_ACCOUNT: { limit: 1000, windowSeconds: 60 },
  PAIRING_CREATE: { limit: 10, windowSeconds: 3600 },
  PAIRING_REDEEM_PER_IP: { limit: 20, windowSeconds: 900 },
  PAIRING_REDEEM_PER_CODE_HASH: { limit: 5, windowSeconds: 900 },
} as const;
export type RateLimitKey = { scope: string; identifier: string };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** Consume a fixed-window bucket. `identifier` must be a hash or non-secret identifier, never plaintext credentials. */
export async function consume(key: RateLimitKey, limit: number, windowSeconds: number, now = new Date()): Promise<RateLimitResult> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) throw new Error('Rate limit parameters must be positive integers');
  await connectDB();
  await RateLimitBucket.init();
  const windowMilliseconds = windowSeconds * 1_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
  const expiresAt = new Date(windowStart.getTime() + windowMilliseconds * 2);
  const bucket = await RateLimitBucket.findOneAndUpdate(
    { scope: key.scope, identifier: key.identifier, windowStart },
    { $inc: { count: 1 }, $setOnInsert: { expireAt: expiresAt } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
  const count = bucket?.count ?? 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMilliseconds - now.getTime()) / 1_000)) };
}
