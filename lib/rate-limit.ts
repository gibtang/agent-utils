import connectDB from './mongodb';
import KvEntry from '@/models/KvEntry';

interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds until reset, only when blocked
}

/**
 * Check rate limit using KV store with __rl: prefix.
 * Atomic increment + compare pattern.
 */
export async function checkRateLimit(
  apiKeyId: string,
  userId: string,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  await connectDB();

  const internalKey = `__rl:${key}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  // Try to find existing counter
  const existing = await KvEntry.findOne({ apiKeyId, key: internalKey }).lean();

  if (!existing || (existing.expiresAt && existing.expiresAt < now)) {
    // No counter or expired window — create new
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    await KvEntry.findOneAndUpdate(
      { apiKeyId, key: internalKey },
      { $set: { userId, value: 1, expiresAt } },
      { upsert: true }
    );
    return {
      allowed: true,
      count: 1,
      remaining: limit - 1,
      resetAt,
    };
  }

  // Existing counter within window — atomic increment
  const updated = await KvEntry.findOneAndUpdate(
    { apiKeyId, key: internalKey },
    { $inc: { value: 1 } },
    { new: true }
  );

  const count = (updated?.value as number) || 0;
  const remaining = Math.max(0, limit - count);
  const resetTime = existing.expiresAt;
  const retryAfter = resetTime ? Math.ceil((resetTime.getTime() - now.getTime()) / 1000) : windowSeconds;

  return {
    allowed: count <= limit,
    count,
    remaining,
    resetAt: resetTime || resetAt,
    ...(count > limit && { retryAfter }),
  };
}

/**
 * Reset a rate limit counter by deleting the KV entry.
 */
export async function resetRateLimit(apiKeyId: string, key: string): Promise<boolean> {
  await connectDB();
  const internalKey = `__rl:${key}`;
  const result = await KvEntry.deleteOne({ apiKeyId, key: internalKey });
  return result.deletedCount > 0;
}

/**
 * Get current rate limit counter status.
 */
export async function getRateLimitStatus(apiKeyId: string, key: string, limit: number) {
  await connectDB();
  const now = new Date();
  const internalKey = `__rl:${key}`;
  const entry = await KvEntry.findOne({ apiKeyId, key: internalKey }).lean();

  if (!entry || (entry.expiresAt && entry.expiresAt < now)) {
    return { key, count: 0, remaining: limit, resetAt: null, windowExpired: true };
  }

  const count = (entry.value as number) || 0;
  return {
    key,
    count,
    remaining: Math.max(0, limit - count),
    resetAt: entry.expiresAt,
    windowExpired: false,
  };
}
