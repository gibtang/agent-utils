import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/response';
import { getAuthenticatedUser } from '@/lib/auth-user';
import { createCheckoutSession } from '@/lib/stripe';
import type { TierName } from '@/lib/pricing';

/**
 * POST /api/billing/checkout — Create a Stripe Checkout session for subscribing to a tier.
 * Body: { tier: 'builder' | 'pro' }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { tier } = body;

    const validTiers: TierName[] = ['builder', 'pro'];
    if (!validTiers.includes(tier)) {
      return errorResponse('Invalid tier. Must be builder or pro.', 400);
    }

    const url = await createCheckoutSession(user._id.toString(), tier);
    return successResponse({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    console.error('Checkout error:', err);
    return errorResponse(message, 500);
  }
}
