import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { type TierName } from '@/lib/pricing';
import { successResponse } from '@/lib/response';
import PiiSession from '@/models/PiiSession';

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  await incrementQuota(authResult.apiKey.userId, authResult.apiKey.tier as TierName);

  try {
    const body = await request.json();
    const { sessionId, text } = body;

    if (!sessionId || !text) {
      return successResponse({ error: 'Missing required fields: sessionId, text' }, 400);
    }

    await connectDB();

    const session = await PiiSession.findOne({
      _id: sessionId,
      userId: authResult.apiKey.userId,
    });

    if (!session) {
      return successResponse({ error: 'PII session not found or expired' }, 404);
    }

    // Replace placeholders with original values
    let hydrated = text;
    for (const [placeholder, original] of session.mappings) {
      hydrated = hydrated.replaceAll(placeholder, original);
    }

    return successResponse({
      hydrated,
      replacementsMade: session.mappings.size,
    });
  } catch (err) {
    console.error('PII hydrate error:', err);
    return successResponse({ error: 'Failed to hydrate PII' }, 500);
  }
}
