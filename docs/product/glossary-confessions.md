# Confessions — Glossary

Canonical terminology for the Confessions feature. Use these terms verbatim in
code, API, UI copy, docs, and customer-facing text. Flag any ambiguity.

## Terms

### Confession
A human-reviewable item an agent surfaces for action. Has a title, optional
summary, urgency, expiry, and a signed `confession.resolved` callback. Lives at
`/c/{id}` (token-gated). Status lifecycle: `pending → resolved | cancelled | expired`.
Model: `models/v2/Confession.ts` (`conf_<ulid>`).

### Reviewer
The human who receives a Confession and decides on it. In v1 the default
reviewer is the tenant's `ownerEmail`; an agent may override per-Confession via
`reviewer_email`. A reviewer does NOT need a Firebase account — access is via a
magic-link token.

### Magic-link Token
A 32-byte opaque string (`ct_<hex>`) issued per Confession, stored as a sha256
hash. Carried in the email link as `/c/{id}?t=…`. Two scopes:
- **view** — load the review page (reusable, 24h TTL)
- **resolve** — submit a decision (single-use, revoked on first resolution)

The token IS the auth — a forwarded email grants access only to that one
Confession and only until expiry/revocation. Sensitive content is never in the
URL.

### NotificationJob
An idempotent, retry-safe unit of email delivery work. Created at Confession
creation (tier 0) and at escalation (tier 1). The tick engine claims each job
atomically (`pending → sending`) and sends a stable HTML snapshot via Resend.
Status: `pending | sending | sent | failed | cancelled`. Model:
`models/v2/NotificationJob.ts` (`nj_<ulid>`).

### Escalation Tier
How many times the reviewer has been notified for a still-pending Confession.
- **Tier 0** — immediate, at creation
- **Tier 1** — escalated, 15 minutes after creation if still pending

`Confession.escalatedAt` is the single atomic flag the escalation sweep uses to
claim a Confession (set-if-null), guaranteeing no duplicate escalation sends.

### Resolution
The terminal act of a reviewer (or the system) deciding a Confession:
`approved`, `rejected`, or `expired`. Recorded on `Confession.resolutionDecision`
+ `resolutionBy` + `resolutionNote` + `resolvedAt`. Cancels pending
notifications and fires the signed callback.

### Open Confessions Inbox
The dashboard section (`/dashboard`, `<ConfessionsInbox />`) listing the
tenant's pending Confessions. Backed by `GET /api/dashboard/confessions`
(Firebase-authed). Shows metadata (title, urgency, agent, expiry, escalation
state) but NOT the agent's private context.

### Persist-before-notify
The invariant that Confession creation succeeds even if the email provider is
down. The Confession document is written first; the NotificationJob is enqueued
after. Email-provider failure never rolls back creation.

## Out of vocabulary (avoid)

- "Approval" for Confessions — use **resolution** (Approval is a Checkpoint
  term; Confessions use approve/reject as the two reviewer decisions, but the
  act is "resolution").
- "Reviewer roster" — not in v1 (we use `ownerEmail` only). Reserved for the
  follow-up that adds a `ReviewerEmail` collection.
- "Digest" — not in v1 (immediate-only). Reserved for the follow-up.
