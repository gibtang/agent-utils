import { NextRequest } from 'next/server';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { resetRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return errorResponse('key is required', 400);
    }

    const reset = await resetRateLimit(authResult.apiKey._id, key);
    return successResponse({ key, reset });
  } catch (err) {
    console.error('Rate limit reset error:', err);
    return errorResponse('Failed to reset rate limit', 500);
  }
}
