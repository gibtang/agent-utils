import { NextRequest, NextResponse } from 'next/server';
import connectDB from './mongodb';
import ApiKey from '@/models/ApiKey';

export interface AuthResult {
  success: true;
  apiKey: {
    _id: string;
    userId: string;
    name: string;
    tier: string;
    key: string;
  };
}

export interface AuthError {
  success: false;
  error: string;
  statusCode: number;
}

export async function validateApiKey(request: NextRequest): Promise<AuthResult | AuthError> {
  const key = request.headers.get('x-api-key');

  if (!key) {
    return { success: false, error: 'Missing x-api-key header', statusCode: 401 };
  }

  try {
    await connectDB();
    const apiKey = await ApiKey.findOne({ key, active: true }).lean();

    if (!apiKey) {
      return { success: false, error: 'Invalid API key', statusCode: 401 };
    }

    // Check rate limit
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setHours(0, 0, 0, 0); // Start of today

    const { getTierConfig } = await import('./pricing');
    const tierConfig = getTierConfig(apiKey.tier as string);

    if (tierConfig.requestsPerDay !== -1) {
      if (apiKey.lastUsedAt && apiKey.lastUsedAt >= windowStart) {
        if (apiKey.dailyCount >= tierConfig.requestsPerDay) {
          return {
            success: false,
            error: `Rate limit exceeded. ${tierConfig.requestsPerDay} requests/day on ${apiKey.tier} tier.`,
            statusCode: 429,
          };
        }
      }
    }

    // Increment daily counter (reset if new day)
    const update: Record<string, unknown> = { lastUsedAt: now };
    if (!apiKey.lastUsedAt || apiKey.lastUsedAt < windowStart) {
      update.dailyCount = 1;
    } else {
      update.$inc = { dailyCount: 1 };
    }

    await ApiKey.updateOne({ _id: apiKey._id }, update);

    return {
      success: true,
      apiKey: {
        _id: apiKey._id.toString(),
        userId: apiKey.userId.toString(),
        name: apiKey.name,
        tier: apiKey.tier,
        key: apiKey.key,
      },
    };
  } catch (error) {
    console.error('Auth error:', error);
    return { success: false, error: 'Internal server error', statusCode: 500 };
  }
}

export function errorResponse(error: AuthError) {
  return NextResponse.json(
    { error: error.error, code: `HTTP_${error.statusCode}` },
    { status: error.statusCode }
  );
}
