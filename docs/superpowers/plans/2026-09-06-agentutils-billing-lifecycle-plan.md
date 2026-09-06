# AgentUtils Billing and Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add launch-ready Stripe subscriptions, exact plan enforcement, actionable owner notifications, retention, Trash, account deletion, and safe Coolify maintenance.

**Architecture:** Stripe is the authority for paid subscription state; Account stores a monotonic local projection used for fast authorization. The shared plan catalogue drives capacity, usage, retention, pricing copy, and tests. Lifecycle work runs through idempotent domain functions under a Mongo lease and is invoked by an in-container Coolify scheduled command, never a public tick route.

**Tech Stack:** Stripe Node SDK, Mongoose transactions, Resend, TypeScript, Next.js owner routes, Vitest, Docker, Coolify scheduled tasks.

---

## Task 1: Create Stripe Checkout and billing portal sessions safely

**Files:**

- Create: `lib/billing/stripe.ts`
- Create: `lib/billing/service.ts`
- Create: `lib/billing/schemas.ts`
- Create: `app/api/billing/checkout/route.ts`
- Create: `app/api/billing/portal/route.ts`
- Test: `__tests__/billing/checkout.test.ts`
- Test: `__tests__/billing/portal.test.ts`

- [ ] Write tests that only an authenticated owner can create sessions, only `plus` or `pro` is accepted, the server chooses the configured Price ID, success/cancel/return URLs stay under `APP_URL`, and no request field can inject a Stripe Price or redirect URL.

- [ ] Create one lazy Stripe client pinned to the SDK's default supported API version. Do not initialize it during static page build.

- [ ] Implement Checkout in `subscription` mode with one server-selected monthly Price, `client_reference_id: accountId`, Account ID and target plan in metadata, and an existing Stripe Customer when present. Create and persist a Customer first when absent.

- [ ] Make repeated clicks safe by reusing an open Checkout Session for the same Account and target plan for up to thirty minutes, or by using a deterministic Stripe idempotency key for that attempt.

- [ ] Implement the billing portal only for Accounts with a Stripe Customer. Create the short-lived portal session on demand and return its URL. Configure plan switching/cancellation in Stripe Dashboard, not from client-supplied portal parameters.

- [ ] Ensure Checkout completion does not directly change the local plan. The signed webhook does that.

- [ ] Run `npm test -- __tests__/billing/checkout.test.ts __tests__/billing/portal.test.ts`; expect all auth, redirect, Price, and idempotency tests to pass.

- [ ] Commit:

```bash
git add lib/billing/stripe.ts lib/billing/service.ts lib/billing/schemas.ts app/api/billing __tests__/billing/checkout.test.ts __tests__/billing/portal.test.ts
git commit -m "feat: add stripe checkout and billing portal"
```

## Task 2: Process signed, replay-safe, out-of-order Stripe billing webhooks

**Files:**

- Create: `models/BillingWebhookEvent.ts`
- Create: `lib/billing/webhook.ts`
- Create: `app/api/webhooks/stripe-billing/route.ts`
- Test: `__tests__/billing/webhook.test.ts`
- Test: `__tests__/billing/webhook-ordering.test.ts`

- [ ] Write raw-body signature tests using Stripe test fixtures. Invalid or missing `Stripe-Signature` must return HTTP `400` and change no Account.

- [ ] Handle only these launch-relevant events:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Ignore unrecognized valid event types with HTTP `200` and a safe result.

- [ ] Map Price IDs to plans from server configuration. An unknown Price ID must not grant paid access and must create a safe Needs attention Activity Record.

- [ ] Store Stripe Event ID, object ID, event type, Stripe `created`, livemode, processing status, and safe failure code. Never store card details or the full webhook payload.

- [ ] Use a unique Stripe Event ID and one transaction for deduplication plus Account projection. Compare Stripe object update timestamps/event creation ordering so a delayed older update cannot overwrite newer subscription state.

- [ ] Project Customer ID, Subscription ID, subscription status, plan, current period boundaries, cancel-at-period-end, last Stripe event time, and payment recovery deadline. Reject test-mode events at a live endpoint and live-mode events in a configured test deployment.

- [ ] Keep the billing route separate from `/hooks/inbox/[token]`; it uses only `STRIPE_BILLING_WEBHOOK_SECRET`, never an Inbox Stripe secret.

- [ ] Run `npm test -- __tests__/billing/webhook.test.ts __tests__/billing/webhook-ordering.test.ts`; expect replay and every out-of-order permutation to preserve the newest state.

- [ ] Commit:

```bash
git add models/BillingWebhookEvent.ts lib/billing/webhook.ts app/api/webhooks/stripe-billing __tests__/billing/webhook.test.ts __tests__/billing/webhook-ordering.test.ts
git commit -m "feat: project stripe subscription state"
```

## Task 3: Enforce limits and emit 80/100 percent thresholds from one catalogue

**Files:**

- Modify: `lib/billing/plans.ts`
- Modify: `lib/billing/usage.ts`
- Create: `lib/billing/entitlements.ts`
- Create: `app/api/billing/usage/route.ts`
- Test: `__tests__/billing/entitlements.test.ts`
- Test: `__tests__/billing/thresholds.test.ts`

- [ ] Write table-driven tests across Free, Plus, and Pro for Connections, Inboxes, monthly Events, active File bytes, State bytes, Event retention, File lifetime, and individual File size.

- [ ] Implement `getEntitlements(account, now)` from the local Stripe projection. Active/trialing paid subscriptions get their plan; past-due subscriptions keep paid access only until a recovery deadline capped at seven days; ended recovery returns Free.

- [ ] Make the same entitlement call power all existing Connection, Inbox, State, and File capacity checks. Delete feature-local copied limit constants.

- [ ] Emit a threshold transition only when usage crosses from below to at least 80 percent or first reaches 100 percent in a usage window. Store notification markers atomically with the counter so concurrent requests enqueue one notification.

- [ ] Return exact usage, exact limit, percentage, reset/retention details, and hard-limit behavior from the Firebase-owner usage route. Do not use client analytics as billing truth.

- [ ] Run `npm test -- __tests__/billing`; expect all plan tables, paid recovery, thresholds, and hard-limit tests to pass.

- [ ] Commit:

```bash
git add lib/billing app/api/billing/usage __tests__/billing
git commit -m "feat: enforce launch plan entitlements"
```

## Task 4: Implement upgrade retention changes and seven-day downgrade grace

**Files:**

- Create: `lib/billing/transitions.ts`
- Create: `app/api/billing/downgrade-selection/route.ts`
- Test: `__tests__/billing/transitions.test.ts`
- Test: `__tests__/billing/downgrade-selection.test.ts`

- [ ] Write tests that an upgrade extends unexpired Event retention from original receipt time, never revives expired Events, and allows longer lifetimes only for new Files.

- [ ] On downgrade or ended payment recovery, set `downgradeTo`, `downgradeEffectiveAt = now + 7 days`, and a selection-needed flag when active Connections or Inboxes exceed the target plan.

- [ ] Add an owner route that accepts exact Connection and Inbox IDs to keep. Validate ownership, target counts, and that all selected resources are active candidates. Save selection without suspending before the effective time.

- [ ] At the effective time, keep owner-selected resources. If no valid selection exists, keep earliest-created resources up to the target limit and suspend newer excess resources. Suspended Inboxes stop receipt immediately but remain visible.

- [ ] Recalculate Event expiry from original receipt time under the lower plan. Existing File expiry remains unchanged during grace, then recalculates from File creation time. State above quota stays readable and deletable but positive-size writes fail.

- [ ] Make transition application idempotent and safe under duplicate Stripe updates plus maintenance overlap.

- [ ] Run `npm test -- __tests__/billing/transitions.test.ts __tests__/billing/downgrade-selection.test.ts`; expect every boundary at exactly seven days to pass.

- [ ] Commit:

```bash
git add lib/billing/transitions.ts app/api/billing/downgrade-selection __tests__/billing/transitions.test.ts __tests__/billing/downgrade-selection.test.ts
git commit -m "feat: apply safe subscription transitions"
```

## Task 5: Add safe Activity Records and actionable notifications

**Files:**

- Create: `models/ActivityRecord.ts`
- Create: `models/OwnerNotification.ts`
- Create: `lib/activity/service.ts`
- Create: `lib/notifications/service.ts`
- Create: `lib/notifications/email.ts`
- Create: `app/api/activity/route.ts`
- Test: `__tests__/activity/service.test.ts`
- Test: `__tests__/notifications/service.test.ts`
- Test: `__tests__/notifications/redaction.test.ts`

- [ ] Define an Activity allowlist: actor type/opaque ID, action enum, resource type/opaque ID, result, safe reason code, timestamp, and request ID. Reject arbitrary metadata objects.

- [ ] Retain Activity Records for ninety days on every plan. Never write Event bodies, State values, filenames, File content, receiving addresses, Pairing Codes, credentials, signing secrets, presigned URLs, email bodies, or Stripe payloads.

- [ ] Enqueue owner notifications only for:

```text
new or revoked Connection security change
Connection reaches three consecutive authenticated server failures
Event reaches three Claim releases/expiries
Event remains unprocessed for min(24 hours, half its retention window)
usage first crosses 80 percent or reaches 100 percent
Stripe payment failure, downgrade selection, cancellation, or unknown Price
account deletion requested, cancelled, or finalized
maintenance fails three consecutive runs
```

- [ ] Deduplicate by `{ accountId, kind, resourceId, windowKey }`. A successful Connection operation clears its consecutive failure counter. Do not email for each Event.

- [ ] Send through Resend with a plain-language subject, what needs attention, one safe dashboard link, and no sensitive resource content. Record delivery status and retry transient failures with a bounded attempt count.

- [ ] Add a paginated owner Activity route with safe filters. It must be a product activity feed, not a customer-facing append-only audit API.

- [ ] Run `npm test -- __tests__/activity __tests__/notifications`; expect redaction and deduplication tests to pass.

- [ ] Commit:

```bash
git add models/ActivityRecord.ts models/OwnerNotification.ts lib/activity lib/notifications app/api/activity __tests__/activity __tests__/notifications
git commit -m "feat: add actionable owner activity and alerts"
```

## Task 6: Record the privacy-safe activation and conversion funnel

**Files:**

- Create: `models/ProductMilestone.ts`
- Create: `lib/analytics/product.ts`
- Create: `lib/analytics/client.ts`
- Modify: `lib/connections/service.ts`
- Modify: `lib/inbox/service.ts`
- Modify: `lib/inbox/receive.ts`
- Modify: `lib/inbox/processing.ts`
- Modify: `lib/state/service.ts`
- Modify: `lib/files/service.ts`
- Modify: `lib/billing/service.ts`
- Modify: `lib/billing/webhook.ts`
- Test: `__tests__/analytics/product.test.ts`
- Test: `__tests__/analytics/redaction.test.ts`

- [ ] Define an allowlist containing exactly: `homepage_cta_selected`, `google_sign_in_started`, `google_sign_in_completed`, `pairing_code_created`, `connection_confirmed`, `first_inbox_created`, `first_test_event_received`, `first_event_completed`, `first_state_record_stored`, `first_file_finalised`, `checkout_started`, and `subscription_activated`.

- [ ] Store server-confirmed milestones once per Account with opaque Account/resource IDs, timestamp, and safe source/runtime/plan enums only. Add a unique `{ accountId, name }` index so retries and races remain idempotent.

- [ ] Make source parsers return a safe `isTestEvent` boolean from documented provider test/ping types or the owner setup test route. Do not inspect or retain arbitrary payload fields for analytics.

- [ ] Call the milestone service only after the underlying transaction succeeds: code creation, Connection commit, Inbox commit, test Event commit, Event completion, first State create, File availability, Checkout Session creation, and signed subscription activation.

- [ ] Use the client wrapper only for homepage CTA and sign-in-start directional events. It accepts no arbitrary property object and never powers billing, limits, retention, or operational status.

- [ ] Write redaction tests that attempt Pairing Codes, credentials, receiving addresses, Event bodies, State values, filenames, File content, signature secrets, presigned URLs, emails, and provider fields. Every attempt must fail before reaching analytics or persistence.

- [ ] Run `npm test -- __tests__/analytics`; expect idempotency, post-commit timing, allowlist, and redaction tests to pass.

- [ ] Commit:

```bash
git add models/ProductMilestone.ts lib/analytics lib/connections/service.ts lib/inbox lib/state/service.ts lib/files/service.ts lib/billing __tests__/analytics
git commit -m "feat: record privacy safe product milestones"
```

## Task 7: Implement Trash, permanent deletion, and Account deletion

**Files:**

- Create: `lib/lifecycle/trash.ts`
- Create: `lib/lifecycle/account-deletion.ts`
- Create: `app/api/trash/route.ts`
- Create: `app/api/account/deletion/route.ts`
- Test: `__tests__/lifecycle/trash.test.ts`
- Test: `__tests__/lifecycle/account-deletion.test.ts`

- [ ] Write a Trash aggregation test covering deleted Inboxes, State Records, and Files, each with exact restore deadline and safe metadata. Expired resources do not appear in Trash.

- [ ] Implement signed, short-lived owner confirmation tokens bound to owner UID, action, resource ID, and expiry for permanent deletion. Confirmation tokens are not stored and cannot be replayed for another resource.

- [ ] Account deletion requires a fresh confirmation token and an exact phrase in the UI request. In one transaction set `pending_deletion`, `purgeAfter = now + 7 days`, suspend Connections with reason `account_deletion`, suspend Inboxes, and enqueue the owner notice. Authentication treats suspended Connections as revoked access, but cancellation can restore their prior state.

- [ ] Cancellation before `purgeAfter` returns the Account to its prior subscription-derived state, restores Connections and Inboxes that were active before the request, and does not revive independently deleted/expired resources.

- [ ] Finalization permanently removes active payloads and authentication access, queues B2 deletion, deletes non-required personal/profile data, and retains only legally required billing records with an explicit retention category. Backup copies age out within thirty days and are not user-accessible.

- [ ] Run `npm test -- __tests__/lifecycle`; expect exact-time boundary, cancellation, irreversible finalization, and cross-Account tests to pass.

- [ ] Commit:

```bash
git add lib/lifecycle/trash.ts lib/lifecycle/account-deletion.ts app/api/trash app/api/account/deletion __tests__/lifecycle
git commit -m "feat: add trash and account deletion lifecycle"
```

## Task 8: Build the idempotent in-container maintenance command

**Files:**

- Create: `models/MaintenanceRun.ts`
- Create: `lib/lifecycle/maintenance.ts`
- Create: `scripts/maintenance.ts`
- Modify: `package.json`
- Modify: `Dockerfile`
- Create: `docs/deployment/coolify.md`
- Test: `__tests__/lifecycle/maintenance.test.ts`
- Test: `__tests__/lifecycle/maintenance-overlap.test.ts`

- [ ] Write tests for each maintenance unit independently: release expired Claims; expire Events and State; abandon pending uploads; expire Files and links; delete pending B2 objects; purge Trash; apply downgrade transitions; finalize Accounts; enqueue unprocessed/failure notices; retry notifications; reconcile recoverable Stripe state.

- [ ] Implement each unit as an idempotent bounded batch using conditional updates. Return only safe counts and reason codes.

- [ ] Acquire a Mongo lease with owner ID and `leaseExpiresAt`; renew while working. If another healthy run owns the lease, exit `0` with `skipped: overlap`. A crashed run becomes recoverable after the lease expires.

- [ ] Record start/end, duration, safe counts, result, and failure code in `MaintenanceRun`. After three consecutive failures, enqueue one operational owner/admin alert without customer payloads.

- [ ] Add scripts:

```json
"maintenance": "tsx scripts/maintenance.ts",
"maintenance:dry-run": "tsx scripts/maintenance.ts --dry-run"
```

Ensure production dependencies include the runtime needed by this command inside the final Docker stage.

- [ ] Document exact Coolify setup: command `npm run maintenance`, frequency `* * * * *`, timeout `60`, correct application container, server timezone awareness, manual Execute Now verification, and where to inspect captured output. State that container filesystems are disposable.

- [ ] Run:

```bash
npm test -- __tests__/lifecycle/maintenance.test.ts __tests__/lifecycle/maintenance-overlap.test.ts
npm run maintenance:dry-run
docker build -t agentutils:maintenance .
```

Expected: overlap has one active worker, dry-run makes no mutations, and the command exists in the built image.

- [ ] Commit:

```bash
git add models/MaintenanceRun.ts lib/lifecycle/maintenance.ts scripts/maintenance.ts package.json package-lock.json Dockerfile docs/deployment/coolify.md __tests__/lifecycle
git commit -m "feat: add coolify lifecycle maintenance"
```

## Task 9: Billing and lifecycle security gate

**Files:**

- Create: `__tests__/security/billing-boundary.test.ts`
- Create: `__tests__/integration/billing-journey.test.ts`
- Create: `__tests__/integration/lifecycle-journey.test.ts`

- [ ] Prove browser owners cannot create Checkout/portal sessions for another Account, client input cannot choose Price IDs, Stripe customer-source signatures cannot authenticate the billing route, and billing signatures cannot configure an Inbox.

- [ ] Use Stripe CLI or signed fixtures to exercise Free to Plus, Plus to Pro, downgrade, payment failure/recovery, cancellation, duplicate delivery, and out-of-order delivery. Verify entitlements only change after webhook processing.

- [ ] Exercise 80/100 percent thresholds, resource suspension selection, Trash restore, Account deletion cancellation, finalization, and overlapping maintenance.

- [ ] Run:

```bash
npm test
npm run check:contracts
npm run maintenance:dry-run
npm run lint
npx tsc --noEmit
npm run build
docker build -t agentutils:billing .
git diff --check
```

Expected: all commands exit `0`; no public `/v1/tick` or anonymous maintenance endpoint exists.

- [ ] Commit:

```bash
git add __tests__/security/billing-boundary.test.ts __tests__/integration/billing-journey.test.ts __tests__/integration/lifecycle-journey.test.ts
git commit -m "test: verify billing and lifecycle boundaries"
```
