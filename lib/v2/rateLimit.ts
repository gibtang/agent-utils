/**
 * AgentUtils v2 — per-tenant rate limiting (PRD §5.6).
 *
 * Per-tenant sliding-minute counter. Atomic increment so concurrent requests
 * can't all pass. Free: 60/min, Pro: 1000/min.
 */
import connectDB from './db';
import Tenant from '@/models/v2/Tenant';
import { Errors, ApiError } from './errors';
import type { RateLimitHeaders } from './envelope';

export interface RateLimitConfig {
  limit: number; // requests/minute
}

export const PLAN_RATE_LIMIT: Record<string, RateLimitConfig> = {
  free: { limit: 60 },
  pro: { limit: 1000 },
};

export interface RateLimitOutcome {
  allowed: boolean;
  headers: RateLimitHeaders;
  retryAfterSeconds?: number;
}

const MINUTE_MS = 60_000;

export async function checkRateLimit(tenantId: string, plan: string): Promise<RateLimitOutcome> {
  await connectDB();
  const cfg = PLAN_RATE_LIMIT[plan] ?? PLAN_RATE_LIMIT.free;
  const now = Date.now();
  const windowStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const resetEpoch = Math.floor((windowStart + MINUTE_MS) / 1000);

  // Track per-tenant minute bucket using a stored counter on the tenant doc.
  // We store {rlBucket, rlCount}. On a new bucket, reset to 1.
  const bucketId = String(windowStart);
  const tenant = await Tenant.findOne({ tenantId }).lean();
  const currentBucket = (tenant as { rlBucket?: string } | null)?.rlBucket;
  const currentCount = (tenant as { rlCount?: number } | null)?.rlCount ?? 0;

  let count: number;
  if (currentBucket === bucketId) {
    const updated = await Tenant.findOneAndUpdate(
      { tenantId, rlBucket: bucketId },
      { $inc: { rlCount: 1 } },
      { returnDocument: "after" },
    ).lean();
    count = (updated as { rlCount?: number } | null)?.rlCount ?? currentCount + 1;
  } else {
    const updated = await Tenant.findOneAndUpdate(
      { tenantId },
      { $set: { rlBucket: bucketId, rlCount: 1 } },
      { returnDocument: "after" },
    ).lean();
    count = (updated as { rlCount?: number } | null)?.rlCount ?? 1;
  }

  const remaining = Math.max(0, cfg.limit - count);
  return {
    allowed: count <= cfg.limit,
    headers: { limit: cfg.limit, remaining, reset: resetEpoch },
    ...(count > cfg.limit && { retryAfterSeconds: Math.max(1, resetEpoch - Math.floor(now / 1000)) }),
  };
}

/** Turn a rate-limit failure into the standard error response input. */
export function rateLimitError(retryAfterSeconds: number): ApiError {
  return Errors.rateLimited(retryAfterSeconds);
}
