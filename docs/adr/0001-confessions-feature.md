# ADR 0001 — Confessions feature

- **Status:** Accepted
- **Date:** 2026-07-26
- **Service:** agent-utils (v2)
- **Supersedes:** none
- **Related Anban cards:** `6a64294685c6d3ee1c7c4c7d` (notification routing, inbox, escalation), `6a66149885c6d3ee1c7c4c82` (default email notification)

## Context

Two Anban cards requested human-notification routing for a "Confessions" feature.
Investigation during planning found that **Confessions did not exist in the
codebase** — both cards were written against an assumed-but-unbuilt feature
(they referenced `/c/{id}`, a `callback_url` flow, and "existing" review UI).

This ADR records the architectural choices made when building Confessions from
scratch in a single PR (the two cards were ~80% overlapping and were merged per
the grilling decision). The existing HitL Checkpoint + `/v1/tick` cron +
`deliverCallback` HMAC + DLQ cascade were the established patterns; Confessions
mirrors them and adds a notification layer.

## Decision

### 1. Magic-link tokens for reviewer auth (not Firebase accounts)

A reviewer who receives a Confession may not have — and must not need — a
Firebase account. We issue a 32-byte opaque token (`ct_<hex>`) per Confession,
stored as a sha256 hash, embedded in the email link as `/c/{id}?t=…`. Scopes:
`view` (reusable, 24h) and `resolve` (single-use, revoked on resolution). The
page reveals nothing without a valid token; agent context is never returned by
the public endpoint.

**Rejected:** Firebase-login-required (friction, assumes account);
approval-proxy key in URL (long-lived, conflicts with the cards' "short-lived"
requirement).

### 2. Async delivery via the `/v1/tick` cron (not inline)

Email send happens in the existing tick loop via a new
`processConfessionNotifications()` engine, alongside `fireDueSchedules()` and
`processTimeouts()`. A `NotificationJob` is enqueued at creation time with a
stable HTML snapshot; the tick engine atomically claims each job
(`pending → sending`) and sends the snapshot via Resend. Only the claim winner
sends, so tick retries never duplicate.

**Consequence:** Confession creation succeeds even if Resend is down. The job
is retried with exponential backoff (30s × 3^n, capped at 15min) up to
`maxAttempts`; failures are audited (`confession.email_failed`).

**Rejected:** inline Resend call (provider outage could fail creation);
dedicated worker queue (overkill — the tick pattern already exists).

### 3. Tenant `ownerEmail` as the default reviewer (no separate roster)

The default reviewer is the tenant's existing `ownerEmail` field (verified at
signup). An agent may override per-Confession via `reviewer_email`. No new
reviewer-roster collection or verification flow is built in this PR.

**Deferred (out of scope):** a `ReviewerEmail` collection with multi-recipient
verification, additional recipients, and per-tenant channel config.

### 4. Escalation tier-1 after 15 minutes

If a Confession is still pending 15 minutes after creation, the escalation
sweep (`processConfessionEscalations()`) atomically claims it via
`escalatedAt: null → now` and enqueues a tier-1 job to the same reviewer with a
fresh view token + `[Escalated]` subject. The atomic claim guarantees no
duplicate escalation sends across concurrent ticks.

The 15-minute default is hardcoded; per-tenant configurability is deferred.

### 5. Terminal-state cancellation

Resolving, cancelling, or expiring a Confession calls
`cancelPendingNotifications(confessionId)`, an atomic `updateMany` that flips
all `pending` jobs to `cancelled`. This guarantees no email fires after a
Confession has reached a terminal state, regardless of tick timing.

### 6. Callback semantics mirror HitL

`confession.resolved` callbacks use the same `deliverCallback()` + HMAC signing
as `checkpoint.resolved`. Delivery failure cascades to the DLQ with
`source: 'confession'`, leaving the Confession's resolved status intact (the
DLQ handles delivery independently — same as Checkpoints).

### 7. Single PR for both cards

The two Anban cards overlap ~80% (Card 2 is a subset of Card 1's DoD). Splitting
them would duplicate the model, create endpoint, and review page. They are
shipped as one PR; both cards are updated with the PR link and closed together.

## Consequences

- **New env vars required:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`
  (the latter already used by the existing tick; now documented in
  `.env.example`).
- **New Tenant counter:** `pendingConfessionCount` (quota: 25 free / 1000 pro).
- **New tick engines add load to `/v1/tick`:** the three new sweeps are
  batched (`limit` per sweep) and run in parallel with existing engines.
- **Public route `/c/[id]` added to `publicPaths`:** the magic-link page must
  load without the auth cookie; the token is the auth.
- **Reviewer-only fields:** the public `/api/c/{id}` endpoint omits agent
  `context`; the dashboard inbox omits it too. Context is visible only to the
  creating agent via the authenticated v1 GET.

## Open questions / follow-ups

- Per-tenant reviewer roster beyond `ownerEmail`
- Webhook / Telegram / Slack notification channels (email-only for v1)
- Digest delivery (immediate-only for v1)
- Per-tenant escalation delay config (hardcoded 15min for v1)
- Link-expiry re-issue flow (a reviewer whose token expired must ask the agent
  to re-issue today)
