import { NextRequest } from 'next/server';
import { handleWebhook } from '@/lib/stripe';
import Stripe from 'stripe';

/**
 * POST /api/billing/webhook — Handle Stripe webhook events.
 * Reads raw body for signature verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 400 });
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 });
    }

    const stripe = new Stripe(secret);
    const event = stripe.webhooks.constructEvent(body, signature, secret);

    await handleWebhook(event);

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler failed';
    console.error('Webhook error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
}
