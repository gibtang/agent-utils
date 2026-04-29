import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse, errorResponse } from '@/lib/response';
import User from '@/models/User';
import { createPortalSession } from '@/lib/stripe';

/**
 * POST /api/billing/portal — Create a Stripe Billing Portal session.
 */
export async function POST(request: NextRequest) {
  try {
    const firebaseUid = request.headers.get('x-firebase-uid');
    if (!firebaseUid) {
      return errorResponse('Missing x-firebase-uid header', 401);
    }

    await connectDB();
    const user = await User.findOne({ firebaseUid, active: true });
    if (!user) {
      return errorResponse('User not found', 404);
    }

    const url = await createPortalSession(user._id.toString());
    return successResponse({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    console.error('Portal error:', err);
    return errorResponse(message, 500);
  }
}
