import Stripe from 'stripe';
import connectDB from './mongodb';
import User from '@/models/User';

// Lazy-initialize Stripe to avoid crashing if key is missing during tests
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
}

/**
 * Create a Stripe Checkout Session for subscribing to a tier.
 */
export async function createCheckoutSession(userId: string, tier: string): Promise<string> {
  const stripe = getStripe();
  await connectDB();

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Ensure customer exists in Stripe
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    await User.updateOne({ _id: userId }, { stripeCustomerId: customerId });
  }

  // Price lookup
  const prices: Record<string, string> = {
    builder: process.env.STRIPE_BUILDER_PRICE_ID!,
    pro: process.env.STRIPE_PRO_PRICE_ID!,
  };

  const priceId = prices[tier];
  if (!priceId) throw new Error(`No Stripe price configured for tier: ${tier}`);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?canceled=true`,
    metadata: { userId: user._id.toString(), tier },
  });

  return session.url!;
}

/**
 * Create a Stripe Billing Portal session for managing subscriptions.
 */
export async function createPortalSession(userId: string): Promise<string> {
  const stripe = getStripe();
  await connectDB();

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (!user.stripeCustomerId) throw new Error('No Stripe customer found');

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile`,
  });

  return session.url;
}

/**
 * Handle Stripe webhook events for subscription lifecycle.
 */
export async function handleWebhook(event: Stripe.Event): Promise<void> {
  await connectDB();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, tier } = session.metadata || {};
      if (!userId || !tier) break;

      const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
      const item = subscription.items.data[0];
      await User.updateOne({ _id: userId }, {
        tier,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        billingCycleStart: item ? new Date(item.current_period_start * 1000) : undefined,
        billingCycleEnd: item ? new Date(item.current_period_end * 1000) : undefined,
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      // Fetch full subscription to get items with period data
      const fullSubscription = await getStripe().subscriptions.retrieve(subscription.id);
      const item = fullSubscription.items.data[0];
      await User.updateOne({ subscriptionId: subscription.id }, {
        subscriptionStatus: subscription.status,
        ...(item ? {
          billingCycleStart: new Date(item.current_period_start * 1000),
          billingCycleEnd: new Date(item.current_period_end * 1000),
        } : {}),
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await User.updateOne({ subscriptionId: subscription.id }, {
        tier: 'free',
        subscriptionStatus: 'canceled',
        subscriptionId: '',
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.parent?.subscription_details?.subscription;
      if (subscriptionId && typeof subscriptionId === 'string') {
        await User.updateOne({ subscriptionId }, {
          subscriptionStatus: 'past_due',
        });
      }
      break;
    }
  }
}

/**
 * Report metered usage for overage billing to Stripe.
 */
export async function reportUsage(userId: string, quantity: number): Promise<void> {
  const stripe = getStripe();
  await connectDB();

  const user = await User.findById(userId);
  if (!user || !user.subscriptionId) return;

  // Report usage via meter events (replaces deprecated createUsageRecord)
  await stripe.billing.meterEvents.create({
    event_name: 'overage',
    payload: {
      stripe_customer_id: user.stripeCustomerId,
      value: String(quantity),
    },
  });
}
