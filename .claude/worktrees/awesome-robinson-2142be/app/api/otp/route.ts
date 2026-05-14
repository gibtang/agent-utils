import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getTierConfig, type TierName } from '@/lib/pricing';
import OtpSession from '@/models/OtpSession';

/**
 * POST /api/otp — Provision a temporary phone number for OTP verification
 * Body: { "countryCode": "US" } (optional, defaults to US)
 *
 * Returns: sessionId + phoneNumber for the agent to use
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request, { skipQuota: true });
  if (!auth.success) return authErrorResponse(auth);

  const tierConfig = getTierConfig(auth.apiKey.tier as TierName);
  if (!tierConfig.features.otp) {
    return errorResponse('OTP verification requires Pro or Enterprise tier', 403, 'UPGRADE_REQUIRED');
  }

  await incrementQuota(auth.apiKey.userId, auth.apiKey.tier as TierName, auth.apiKey._id);

  try {
    const body = await request.json().catch(() => ({}));
    const countryCode = (body.countryCode || 'US').toUpperCase();

    // Only US supported in MVP
    if (countryCode !== 'US') {
      return errorResponse('Only US numbers supported in current version', 400);
    }

    // Check for Twilio config
    const twilioPhoneSid = process.env.TWILIO_PHONE_NUMBER_SID;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioPhoneSid || !twilioNumber) {
      return errorResponse('OTP service not configured. Set TWILIO_PHONE_NUMBER_SID and TWILIO_PHONE_NUMBER.', 503, 'SERVICE_UNCONFIGURED');
    }

    await connectDB();

    // Limit active sessions per user (5 max)
    const activeCount = await OtpSession.countDocuments({
      userId: auth.apiKey.userId,
      status: 'waiting',
      expiresAt: { $gt: new Date() },
    });

    if (activeCount >= 5) {
      return errorResponse('Maximum 5 concurrent OTP sessions. Wait for existing sessions to expire.', 429);
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const session = await OtpSession.create({
      userId: auth.apiKey.userId,
      apiKeyId: auth.apiKey._id,
      phoneNumber: twilioNumber,
      phoneNumberSid: twilioPhoneSid,
      status: 'waiting',
      expiresAt,
    });

    return successResponse({
      sessionId: session._id.toString(),
      phoneNumber: session.phoneNumber,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      instructions: `Use this phone number for verification. Poll GET /api/otp/{sessionId} until status is 'received'.`,
      limitations: {
        note: 'Virtual numbers are blocked by some major platforms.',
        blockedBy: ['WhatsApp', 'Google', 'Meta', 'most crypto exchanges'],
        worksFor: ['niche platforms', 'internal systems', 'third-party APIs without VoIP blocklists'],
      },
    }, 201);
  } catch (error) {
    console.error('OTP create error:', error);
    return errorResponse('Failed to create OTP session', 500);
  }
}

/**
 * GET /api/otp — List active OTP sessions for the authenticated user
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request, { skipQuota: true });
  if (!auth.success) return authErrorResponse(auth);

  const tierConfig = getTierConfig(auth.apiKey.tier as TierName);
  if (!tierConfig.features.otp) {
    return errorResponse('OTP verification requires Pro or Enterprise tier', 403, 'UPGRADE_REQUIRED');
  }

  await incrementQuota(auth.apiKey.userId, auth.apiKey.tier as TierName, auth.apiKey._id);

  try {
    await connectDB();

    const sessions = await OtpSession.find({
      userId: auth.apiKey.userId,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const data = sessions.map((s) => ({
      sessionId: s._id.toString(),
      phoneNumber: s.phoneNumber,
      status: s.status,
      code: s.status === 'received' ? s.code : undefined,
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }));

    return successResponse({ sessions: data });
  } catch (error) {
    console.error('OTP list error:', error);
    return errorResponse('Failed to list OTP sessions', 500);
  }
}
