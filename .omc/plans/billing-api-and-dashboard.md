# Billing API Routes + Dashboard UI Plan

## Current State

Steps 1-6 of PRICING_IMPLEMENTATION_PLAN.md are DONE:
- `lib/pricing.ts` — 4 tiers, monthly quotas, overage
- `models/Usage.ts` — monthly usage per user
- `models/User.ts` — Stripe + billing fields
- `models/ApiKey.ts` — monthly tracking
- `lib/auth.ts` — monthly rate limiting + overage
- `lib/stripe.ts` — full Stripe integration
- `stripe` package installed

**What's missing:** API routes (Step 7) and Dashboard/Profile UI (Step 8).

## Auth Pattern

Existing routes use two auth patterns:
- **API key routes** (`/api/keys`): `Authorization: Bearer <firebase-id-token>` + `firebaseUid` from token
- **User routes** (`/api/user`): `x-firebase-uid` header

Billing routes will follow the **user route pattern** — `x-firebase-uid` header to identify the user.

## Implementation

### Task 1: Create `app/api/billing/checkout/route.ts`

POST handler:
1. Read `x-firebase-uid` + `tier` from request body
2. Look up user by `firebaseUid`
3. Call `createCheckoutSession(user._id, tier)` from `lib/stripe.ts`
4. Return `{ success: true, url: sessionUrl }`

### Task 2: Create `app/api/billing/portal/route.ts`

POST handler:
1. Read `x-firebase-uid` from header
2. Look up user
3. Call `createPortalSession(user._id)` from `lib/stripe.ts`
4. Return `{ success: true, url: portalUrl }`

### Task 3: Create `app/api/billing/webhook/route.ts`

POST handler:
1. Read raw body + `stripe-signature` header
2. Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
3. Pass event to `handleWebhook(event)` from `lib/stripe.ts`
4. Return 200

**Important:** This route needs the raw body. In Next.js App Router, use `request.text()` and pass to Stripe webhook verification.

### Task 4: Create `app/api/billing/usage/route.ts`

GET handler:
1. Read `x-firebase-uid` from header
2. Look up user → get tier + billing cycle
3. Find current Usage record for this period
4. Return usage stats: `{ callsIncluded, callsOverage, totalCalls, quota, overageCost, tier, periodEnd }`

### Task 5: Update Dashboard page (`app/dashboard/page.tsx`)

Add to existing page:
- **Usage card** — replace "Coming soon" with real usage data
  - Fetch `/api/billing/usage` on load
  - Show `callsIncluded / quota` with progress bar
  - Show overage count + cost if applicable
  - Show period end date
- **Upgrade CTA** — if on free tier, show upgrade prompt with link to pricing or checkout

### Task 6: Update Profile page (`app/profile/page.tsx`)

Add billing section:
- **Current plan** — show tier name + price (already partially exists)
- **Manage billing** button — calls `/api/billing/portal` → redirects to Stripe portal
- **Upgrade/Downgrade** buttons — for each available tier, call `/api/billing/checkout`
- **Billing status** — show `subscriptionStatus` (active, past_due, etc.)

### Task 7: Create billing tests (`__tests__/billing.test.ts`)

Test coverage:
- Checkout session creation (success + error cases)
- Portal session creation (success + no customer error)
- Webhook signature verification + event handling
- Usage stats retrieval

## File Summary

| File | Action |
|------|--------|
| `app/api/billing/checkout/route.ts` | **New** |
| `app/api/billing/portal/route.ts` | **New** |
| `app/api/billing/webhook/route.ts` | **New** |
| `app/api/billing/usage/route.ts` | **New** |
| `app/dashboard/page.tsx` | **Edit** — add usage display |
| `app/profile/page.tsx` | **Edit** — add billing section |
| `__tests__/billing.test.ts` | **New** — billing API tests |

## Dependencies

All tasks are independent except:
- Task 5+6 depend on Task 4 (usage API needed for dashboard display)
- Task 7 can be written alongside Tasks 1-4

## Env Vars Needed

- `STRIPE_SECRET_KEY` — already used in `lib/stripe.ts`
- `STRIPE_BUILDER_PRICE_ID` — Stripe price ID for Builder tier
- `STRIPE_PRO_PRICE_ID` — Stripe price ID for Pro tier
- `STRIPE_WEBHOOK_SECRET` — for webhook signature verification
- `NEXT_PUBLIC_BASE_URL` — already used in `lib/stripe.ts` for redirect URLs
