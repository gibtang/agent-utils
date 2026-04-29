import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/response';
import { getAuthenticatedUser } from '@/lib/auth-user';
import { createPortalSession } from '@/lib/stripe';

/**
 * POST /api/billing/portal — Create a Stripe Billing Portal session.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const url = await createPortalSession(user._id.toString());
    return successResponse({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    console.error('Portal error:', err);
    return errorResponse(message, 500);
  }
}
