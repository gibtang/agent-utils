import { NextRequest } from 'next/server';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getTierConfig, type TierName } from '@/lib/pricing';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  const tier = authResult.apiKey.tier as TierName;
  const tierConfig = getTierConfig(tier);
  if (!tierConfig.features.rateLimit) {
    return errorResponse('Rate Limiter requires a paid plan', 403);
  }

  try {
    const body = await request.json();
    const { key, limit, windowSeconds } = body;

    if (!key || typeof key !== 'string') {
      return errorResponse('key is required (string)', 400);
    }
    if (!limit || typeof limit !== 'number' || limit < 1) {
      return errorResponse('limit is required (number, min 1)', 400);
    }
    if (!windowSeconds || typeof windowSeconds !== 'number' || windowSeconds < 1) {
      return errorResponse('windowSeconds is required (number, min 1)', 400);
    }

    const result = await checkRateLimit(
      authResult.apiKey._id,
      authResult.apiKey.userId,
      key,
      limit,
      windowSeconds
    );

    await incrementQuota(authResult.apiKey.userId, tier, authResult.apiKey._id);

    const statusCode = result.allowed ? 200 : 429;
    return successResponse(result, statusCode);
  } catch (err) {
    console.error('Rate limit check error:', err);
    return errorResponse('Failed to check rate limit', 500);
  }
}
