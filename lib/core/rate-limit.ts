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

type RateLimitHeaderResult = { remaining: number; retryAfterSeconds?: number | null };

/** Convert a rate-limit result into the standard HTTP headers route adapters return. */
export function rateLimitHeaders(result: RateLimitHeaderResult): Record<string, string> {
  const headers = { 'x-ratelimit-remaining': String(result.remaining) };
  return result.remaining === 0 && result.retryAfterSeconds != null
    ? { ...headers, 'retry-after': String(result.retryAfterSeconds) }
    : headers;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
export async function consume(key: RateLimitKey, limit: number, windowSeconds: number, now = new Date()): Promise<RateLimitResult> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) throw new Error('Rate limit parameters must be positive integers');
  await connectDB();
  await RateLimitBucket.init();
  const windowMilliseconds = windowSeconds * 1_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
  const expiresAt = new Date(windowStart.getTime() + windowMilliseconds * 2);
  const filter = { scope: key.scope, identifier: key.identifier, windowStart };
  const update = { $inc: { count: 1 }, $setOnInsert: { expireAt: expiresAt } };
  const options = { upsert: true, returnDocument: 'after' as const, setDefaultsOnInsert: true };
  let bucket: { count: number } | null = null;
  let retriedAfterDuplicateKey = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      bucket = await RateLimitBucket.findOneAndUpdate(filter, update, options).lean();
      break;
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === 2) throw error;
      retriedAfterDuplicateKey = true;
    }
  }
  // The duplicate insert did not consume a slot. Once the retry has updated the
  // now-existing bucket, re-read it before deriving the HTTP-facing result.
  if (retriedAfterDuplicateKey) bucket = await RateLimitBucket.findOne(filter).lean();
  const count = bucket?.count ?? 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMilliseconds - now.getTime()) / 1_000)) };
}
