# Pricing System Implementation Plan

## Target Model: Hybrid Subscription + Usage Overage

| Tier | Price | Monthly Calls | Overage Rate |
|------|-------|--------------|-------------|
| Free | $0 | 500 | Hard cap (no overage) |
| Builder | $19/mo | 10,000 | $0.002/call |
| Pro | $49/mo | 100,000 | $0.001/call |
| Enterprise | Custom | Custom | Custom |

## Current State Analysis

### What exists
- `lib/pricing.ts` — 3 tiers (free/pro/enterprise), daily rate limits, feature flags
- `models/ApiKey.ts` — `dailyCount` + `lastUsedAt` per key
- `models/User.ts` — `tier` field (free/pro/enterprise)
- `lib/auth.ts` — Daily rate limiting, resets at midnight

### Key Gaps
1. **Daily, not monthly** — `dailyCount` resets at midnight. Need monthly call quotas.
2. **No billing** — No Stripe, no payments, no subscription lifecycle.
3. **Tier enum outdated** — `free | pro | enterprise` → `free | builder | pro | enterprise`.
4. **Per-key, not per-user** — Usage tracked per API key, but billing is user-level.
5. **No overage** — No mechanism to track or bill calls beyond monthly quota.

## Implementation Steps

### Step 1: Update `lib/pricing.ts`

New tier structure:
- 4 tiers: free, builder, pro, enterprise
- Monthly quotas instead of daily
- Overage rates for builder/pro
- Feature flags per tier

```typescript
export type TierName = 'free' | 'builder' | 'pro' | 'enterprise';

export interface TierConfig {
  name: string;
  price: number;           // monthly subscription
  callsPerMonth: number;   // included calls (-1 = unlimited)
  overageRate: number;     // $ per call beyond quota (0 = hard cap)
  maxFileSize: number;
  fileRetentionHours: number;
  features: { ... };
}
```

### Step 2: Create `models/Usage.ts`

Monthly usage bucket per user:
- `userId` — link to user
- `periodStart` / `periodEnd` — billing cycle dates
- `callsIncluded` — calls within quota
- `callsOverage` — calls beyond quota
- `overageCost` — calculated overage charge (cents)
- `toolBreakdown` — optional per-tool counts

### Step 3: Update `models/User.ts`

Add Stripe + billing fields:
- `stripeCustomerId` — Stripe customer ID
- `subscriptionId` — Stripe subscription ID
- `subscriptionStatus` — active/past_due/canceled/trialing
- `billingCycleStart` — current period start
- `billingCycleEnd` — current period end

### Step 4: Update `models/ApiKey.ts`

- Remove `dailyCount` + `lastUsedAt`
- Add `monthlyCount` + `monthStartedAt` (resets on billing cycle)
- Tier inherits from user subscription (not set per-key)

### Step 5: Update `lib/auth.ts`

Monthly rate limiting with overage:
1. Check user's subscription status
2. Aggregate usage across all user's API keys for the month
3. If within quota → allow
4. If over quota + tier allows overage → allow, increment overage counter
5. If over quota + no overage (free tier) → reject with 429 + upgrade prompt

### Step 6: Create `lib/stripe.ts`

Stripe integration:
- `createCheckoutSession(userId, tier)` — redirect to Stripe Checkout
- `createPortalSession(userId)` — manage billing
- `handleWebhook(event)` — subscription lifecycle events
- `reportUsage(userId, quantity)` — metered usage for overage billing

### Step 7: Create `app/api/billing/` routes

- `POST /api/billing/checkout` — create Stripe checkout session
- `POST /api/billing/portal` — create Stripe portal session
- `POST /api/billing/webhook` — Stripe webhook handler
- `GET /api/billing/usage` — current usage stats for dashboard

### Step 8: Update dashboard + profile pages

- Show current usage (calls used / quota)
- Show overage charges if applicable
- Upgrade/downgrade buttons
- Link to Stripe billing portal

### Step 9: Update tests

- `__tests__/pricing.test.ts` — new tiers, overage calculations
- `__tests__/openapi.test.ts` — update tool count if needed
- New: `__tests__/usage.test.ts` — usage tracking logic

## Files Changed Summary

| File | Change |
|------|--------|
| `lib/pricing.ts` | New tier structure, monthly quotas, overage rates |
| `models/Usage.ts` | **New** — monthly usage per user |
| `models/User.ts` | Add Stripe + billing fields |
| `models/ApiKey.ts` | Monthly usage tracking, inherit tier from user |
| `lib/auth.ts` | Monthly rate limiting + overage logic |
| `lib/stripe.ts` | **New** — Stripe integration |
| `app/api/billing/checkout/route.ts` | **New** — checkout session |
| `app/api/billing/portal/route.ts` | **New** — billing portal |
| `app/api/billing/webhook/route.ts` | **New** — Stripe webhooks |
| `app/api/billing/usage/route.ts` | **New** — usage stats |
| `app/dashboard/page.tsx` | Usage display, upgrade UI |
| `app/profile/page.tsx` | Billing management |
| `__tests__/pricing.test.ts` | Update for new tiers |
| `__tests__/usage.test.ts` | **New** — usage tracking tests |
