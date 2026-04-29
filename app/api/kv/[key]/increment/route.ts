import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getTierConfig, type TierName } from '@/lib/pricing';
import KvEntry from '@/models/KvEntry';

// POST /api/kv/:key/increment — Atomic increment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  const tier = authResult.apiKey.tier as TierName;
  const tierConfig = getTierConfig(tier);

  if (!tierConfig.features.kv) {
    return errorResponse('KV Store requires a paid plan. Upgrade at /profile', 403);
  }

  try {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    const body = await request.json();
    const amount = typeof body.amount === 'number' ? body.amount : 1;

    await connectDB();

    const apiKeyId = authResult.apiKey._id;
    const userId = authResult.apiKey.userId;

    // Check if entry exists
    const existing = await KvEntry.findOne({ apiKeyId, key: decodedKey });

    if (!existing) {
      // Create new entry with the amount as initial value
      const expiresAt = new Date(Date.now() + 86400 * 1000);
      const entry = await KvEntry.create({
        userId,
        apiKeyId,
        key: decodedKey,
        value: amount,
        expiresAt,
      });

      await incrementQuota(userId, tier, apiKeyId);

      return successResponse({ key: entry.key, value: entry.value }, 201);
    }

    // Check current value is numeric
    if (typeof existing.value !== 'number') {
      return errorResponse('Current value is not numeric', 400);
    }

    // Atomic increment
    const updated = await KvEntry.findOneAndUpdate(
      { apiKeyId, key: decodedKey },
      { $inc: { value: amount } },
      { new: true }
    );

    await incrementQuota(userId, tier, apiKeyId);

    return successResponse({ key: updated!.key, value: updated!.value });
  } catch (err) {
    console.error('KV increment error:', err);
    return errorResponse('Failed to increment key', 500);
  }
}
