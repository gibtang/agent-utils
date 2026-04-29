import { NextRequest } from 'next/server';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getRateLimitStatus } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    // Use a default limit of 100 for status display (user should know their own limit)
    const status = await getRateLimitStatus(authResult.apiKey._id, decodedKey, 100);
    return successResponse(status);
  } catch (err) {
    console.error('Rate limit status error:', err);
    return errorResponse('Failed to get rate limit status', 500);
  }
}
