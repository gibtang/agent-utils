import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getTierConfig, type TierName } from '@/lib/pricing';
import KvEntry from '@/models/KvEntry';

// PUT /api/kv — Set a key-value pair
export async function PUT(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  const tier = authResult.apiKey.tier as TierName;
  const tierConfig = getTierConfig(tier);

  if (!tierConfig.features.kv) {
    return errorResponse('KV Store requires a paid plan. Upgrade at /profile', 403);
  }

  try {
    const body = await request.json();
    const { key, value, ttl } = body;

    if (!key || typeof key !== 'string') {
      return errorResponse('Missing or invalid key (must be a string)');
    }
    if (key.length > 256) {
      return errorResponse('Key must be 256 characters or less');
    }
    if (value === undefined || value === null) {
      return errorResponse('Missing required field: value');
    }

    // Validate value size
    const jsonStr = JSON.stringify(value);
    if (Buffer.byteLength(jsonStr) > tierConfig.kvMaxValueBytes) {
      return errorResponse(`Value exceeds maximum size of ${tierConfig.kvMaxValueBytes} bytes`, 413);
    }

    await connectDB();

    const userId = authResult.apiKey.userId;
    const apiKeyId = authResult.apiKey._id;

    // Check key count limit (skip if unlimited)
    if (tierConfig.kvMaxKeys !== -1) {
      const existingCount = await KvEntry.countDocuments({ apiKeyId });
      const existingEntry = await KvEntry.findOne({ apiKeyId, key });
      if (!existingEntry && existingCount >= tierConfig.kvMaxKeys) {
        return errorResponse(`Key limit reached (${tierConfig.kvMaxKeys} keys on ${tier} tier). Upgrade at /profile`, 429);
      }
    }

    const expiresAt = new Date(Date.now() + (ttl || 86400) * 1000);

    const entry = await KvEntry.findOneAndUpdate(
      { apiKeyId, key },
      { $set: { userId, value, expiresAt } },
      { upsert: true, new: true }
    );

    await incrementQuota(userId, tier, apiKeyId);

    return successResponse({
      key: entry.key,
      expiresAt: entry.expiresAt,
    }, entry.createdAt === entry.updatedAt ? 201 : 200);
  } catch (err) {
    console.error('KV PUT error:', err);
    return errorResponse('Failed to set key-value pair', 500);
  }
}

// GET /api/kv — List all keys (no values)
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter = { apiKeyId: authResult.apiKey._id };

    const [items, total] = await Promise.all([
      KvEntry.find(filter)
        .select('key expiresAt')
        .sort({ key: 1 })
        .skip(offset)
        .limit(limit),
      KvEntry.countDocuments(filter),
    ]);

    return successResponse({ items, total, limit, offset });
  } catch (err) {
    console.error('KV list error:', err);
    return errorResponse('Failed to list keys', 500);
  }
}
