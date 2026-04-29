import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse, errorResponse } from '@/lib/response';
import User from '@/models/User';
import { createCheckoutSession } from '@/lib/stripe';
import type { TierName } from '@/lib/pricing';

/**
 * POST /api/billing/checkout — Create a Stripe Checkout session for subscribing to a tier.
 * Body: { tier: 'builder' | 'pro' }
 */
export async function POST(request: NextRequest) {
  try {
    const firebaseUid = request.headers.get('x-firebase-uid');
    if (!firebaseUid) {
      return errorResponse('Missing x-firebase-uid header', 401);
    }

    const body = await request.json();
    const { tier } = body;

    const validTiers: TierName[] = ['builder', 'pro'];
    if (!validTiers.includes(tier)) {
      return errorResponse('Invalid tier. Must be builder or pro.', 400);
    }

    await connectDB();
    const user = await User.findOne({ firebaseUid, active: true });
    if (!user) {
      return errorResponse('User not found', 404);
    }

    const url = await createCheckoutSession(user._id.toString(), tier);
    return successResponse({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    console.error('Checkout error:', err);
    return errorResponse(message, 500);
  }
}
