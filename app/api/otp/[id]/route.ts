import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getTierConfig } from '@/lib/pricing';
import OtpSession from '@/models/OtpSession';

/**
 * GET /api/otp/[id] — Poll an OTP session for the verification code
 *
 * Returns status and code (if received)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return errorResponse(auth.error, auth.statusCode);

  const tierConfig = getTierConfig(auth.apiKey.tier as string);
  if (!tierConfig.features.otp) {
    return errorResponse('OTP verification requires Pro or Enterprise tier', 403, 'UPGRADE_REQUIRED');
  }

  try {
    const { id } = await params;
    await connectDB();

    const session = await OtpSession.findOne({
      _id: id,
      userId: auth.apiKey.userId,
    }).lean();

    if (!session) {
      return errorResponse('OTP session not found', 404);
    }

    // Check expiry
    if (new Date() > session.expiresAt && session.status === 'waiting') {
      await OtpSession.updateOne({ _id: id }, { status: 'expired' });
      return successResponse({
        sessionId: session._id.toString(),
        phoneNumber: session.phoneNumber,
        status: 'expired',
        message: 'Session expired. Create a new one.',
      });
    }

    return successResponse({
      sessionId: session._id.toString(),
      phoneNumber: session.phoneNumber,
      status: session.status,
      code: session.status === 'received' ? session.code : null,
      senderNumber: session.senderNumber || null,
      expiresAt: session.expiresAt.toISOString(),
      receivedAt: session.receivedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('OTP poll error:', error);
    return errorResponse('Failed to poll OTP session', 500);
  }
}

/**
 * DELETE /api/otp/[id] — Cancel/expire an OTP session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return errorResponse(auth.error, auth.statusCode);

  try {
    const { id } = await params;
    await connectDB();

    const session = await OtpSession.findOneAndUpdate(
      { _id: id, userId: auth.apiKey.userId, status: 'waiting' },
      { status: 'expired' },
      { new: true }
    ).lean();

    if (!session) {
      return errorResponse('OTP session not found or already completed', 404);
    }

    return successResponse({
      sessionId: session._id.toString(),
      status: 'expired',
      message: 'Session cancelled',
    });
  } catch (error) {
    console.error('OTP delete error:', error);
    return errorResponse('Failed to cancel OTP session', 500);
  }
}
