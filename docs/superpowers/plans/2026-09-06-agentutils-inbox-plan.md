# AgentUtils Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver stable Inboxes that receive verified or explicitly unverified external Events and expose recoverable at-least-once processing to the assigned Agent.

**Architecture:** Each Inbox has a high-entropy receiving token, an assigned Agent, optional same-Account Agent grants, and one source mode. The public route reads bounded raw bytes, verifies the source before parsing, atomically reserves Event usage, and persists an immutable Event before acknowledging. Connection-authenticated operations list, wait, claim, release, and complete Events through one shared service.

**Tech Stack:** Next.js route handlers, TypeScript, Zod, Mongoose atomic updates and transactions, Stripe webhook verification, Node crypto, MCP shared operation registry, Vitest.

---

## Task 1: Model Inboxes, Events, and atomic Event usage

**Files:**

- Create: `models/Inbox.ts`
- Create: `models/InboxEvent.ts`
- Create: `models/RetiredInboxToken.ts`
- Create: `models/UsageWindow.ts`
- Create: `lib/billing/usage.ts`
- Create: `lib/inbox/schemas.ts`
- Test: `__tests__/inbox/models.test.ts`
- Test: `__tests__/billing/usage.test.ts`

- [ ] Write schema tests for source modes `universal`, `generic_hmac`, `stripe`, `github`, and `coolify`; setup states `needs_configuration`, `active`, and `suspended`; Event states `received`, `processing`, and `completed`; verification states `verified` and `unverified`.

- [ ] Assert an Inbox stores `receivingTokenHash` for lookup and `receivingTokenCiphertext` for owner recovery, never a plaintext token. Store source verification configuration only as authenticated ciphertext.

- [ ] Assert accepted Event content fields are immutable after insert. Keep mutable processing fields under `processing`, separate from immutable `content`:

```ts
type InboxEventContent = {
  receivedAt: Date;
  source: 'universal' | 'generic_hmac' | 'stripe' | 'github' | 'coolify';
  verification: 'verified' | 'unverified';
  providerEventId?: string;
  contentType: string;
  headers: Record<string, string>;
  rawBody: Buffer;
  parsed: unknown;
};
```

- [ ] Add indexes for receiving-token hash, Account/Agent Inbox listing, Account/Inbox/Event received-time pagination, provider idempotency, Event expiry, and claim expiry. Use a unique partial index on `{ inboxId, providerEventId }` when the provider ID exists.

- [ ] Keep a `RetiredInboxToken` hash tombstone after permanent Inbox deletion. New token generation checks active and retired hashes, so a retired receiving address can never be assigned again without retaining Event content or source secrets.

- [ ] Write concurrent usage tests. `reserveMonthlyUsage(accountId, 'events', 1, now)` must allow exactly the plan limit, reject the next reservation with `plan_limit_reached`, and never exceed the stored count under parallel calls.

- [ ] Implement `UsageWindow` with an Account and UTC/Stripe-period key plus atomic counters. The billing plan will extend it for State and Files; do not encode Event-specific logic in the model.

- [ ] Run `npm test -- __tests__/inbox/models.test.ts __tests__/billing/usage.test.ts`; expect all model and concurrency tests to pass.

- [ ] Commit:

```bash
git add models/Inbox.ts models/InboxEvent.ts models/UsageWindow.ts lib/billing/usage.ts lib/inbox/schemas.ts __tests__/inbox/models.test.ts __tests__/billing/usage.test.ts
git commit -m "feat: model inboxes events and usage"
```

## Task 2: Implement source verification against exact raw bytes

**Files:**

- Create: `lib/inbox/body.ts`
- Create: `lib/inbox/headers.ts`
- Create: `lib/inbox/verification.ts`
- Create: `lib/inbox/sources/stripe.ts`
- Create: `lib/inbox/sources/github.ts`
- Create: `lib/inbox/sources/generic-hmac.ts`
- Create: `lib/inbox/sources/coolify.ts`
- Create: `lib/inbox/sources/universal.ts`
- Test: `__tests__/inbox/body.test.ts`
- Test: `__tests__/inbox/verification.test.ts`
- Test: `__tests__/inbox/source-parsers.test.ts`

- [ ] Write bounded-body tests for an absent body, exactly 1 MiB, 1 MiB plus one byte, misleading `Content-Length`, chunked input, and a stream that aborts. Implement `readBodyWithLimit(request.body, 1_048_576)` without first buffering an unbounded body.

- [ ] Write header tests that preserve only the source-specific allowlist and always discard cookies, `Authorization`, forwarding headers, tracing headers, and unrelated infrastructure metadata.

- [ ] Write Stripe fixtures that prove whitespace changes break verification. Call `stripe.webhooks.constructEvent(rawBody, stripeSignature, endpointSecret)` before JSON parsing. Extract the Stripe Event ID for idempotency.

- [ ] Write GitHub fixtures using `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA-256 over the raw body, and constant-time comparison. Retain `X-GitHub-Event`, `X-GitHub-Delivery`, and content type only.

- [ ] Define Generic HMAC as:

```text
X-AgentUtils-Timestamp: Unix seconds
X-AgentUtils-Signature: v1=<HMAC-SHA256(secret, timestamp + "." + raw bytes)>
X-AgentUtils-Event-Id: optional idempotency key
```

- [ ] Reject timestamps outside five minutes. Test old, future, malformed, missing, and mismatched signatures.

- [ ] Parse Coolify only after bounded raw capture. Accept documented notification JSON, derive a readable event type and subject when present, and always return `verification: 'unverified'`. Do not invent a signature check.

- [ ] Universal mode accepts valid JSON, form, text, or binary payloads and always returns `unverified`. Use `X-AgentUtils-Event-Id` as optional idempotency input.

- [ ] Implement one `verifyAndParseSource({ inbox, rawBody, headers, now })` dispatcher. Failed verification returns `source_verification_failed`; malformed provider payload returns `validation_failed`; neither logs or returns raw data.

- [ ] Run `npm test -- __tests__/inbox/body.test.ts __tests__/inbox/verification.test.ts __tests__/inbox/source-parsers.test.ts`; expect all source fixtures to pass.

- [ ] Commit:

```bash
git add lib/inbox/body.ts lib/inbox/headers.ts lib/inbox/verification.ts lib/inbox/sources __tests__/inbox/body.test.ts __tests__/inbox/verification.test.ts __tests__/inbox/source-parsers.test.ts
git commit -m "feat: verify inbound event sources"
```

## Task 3: Create, configure, share, restore, and retire Inboxes

**Files:**

- Create: `lib/inbox/service.ts`
- Create: `lib/inbox/presenter.ts`
- Create: `app/api/inboxes/route.ts`
- Create: `app/api/inboxes/[inboxId]/route.ts`
- Create: `app/api/inboxes/[inboxId]/verification/route.ts`
- Create: `app/api/inboxes/[inboxId]/access/route.ts`
- Create: `app/api/trash/inboxes/[inboxId]/restore/route.ts`
- Test: `__tests__/inbox/service.test.ts`
- Test: `__tests__/inbox/owner-routes.test.ts`

- [ ] Write service tests for unique Inbox names per Account, plan capacity, owner/Agent isolation, grants limited to the same Account, reassignment, deletion, seven-day restoration with the same receiving address, and permanent retirement of the old address.

- [ ] Implement `createInbox(actor, input)` so Universal and Coolify begin active, Generic HMAC and GitHub generate a one-time setup secret, and Stripe begins `needs_configuration` until an owner submits the Stripe endpoint secret after creating the Stripe endpoint.

- [ ] Return generated Generic HMAC/GitHub setup secrets only from the creation response. Persist only encrypted ciphertext. For Stripe, the owner-only verification route accepts and encrypts the `whsec_...` value and then marks the Inbox active.

- [ ] Implement `getReceivingUrlForOwner()` by decrypting the stored receiving token. Never include receiving URLs in logs, analytics, Activity Records, list views, or notification email. Permanent deletion inserts the receiving-token hash into `RetiredInboxToken` before removing encrypted token and verification configuration.

- [ ] Implement owner routes for listing/detail, source setup, Agent grants, reassignment, delete, and restore. Use `requireOwner()` and the same service methods as Agent operations.

- [ ] In `presentInboxForConnection`, include name, source, setup state, verification label, assigned Agent, grants visible to that Connection, health, counts, and expiry policy. Do not include source secret ciphertext or receiving token.

- [ ] Run `npm test -- __tests__/inbox/service.test.ts __tests__/inbox/owner-routes.test.ts`; expect all lifecycle and isolation tests to pass.

- [ ] Commit:

```bash
git add lib/inbox/service.ts lib/inbox/presenter.ts app/api/inboxes app/api/trash/inboxes __tests__/inbox/service.test.ts __tests__/inbox/owner-routes.test.ts
git commit -m "feat: manage stable agent inboxes"
```

## Task 4: Accept Events durably at the public receiving route

**Files:**

- Create: `lib/inbox/receive.ts`
- Create: `app/hooks/inbox/[token]/route.ts`
- Test: `__tests__/inbox/receive.test.ts`
- Test: `__tests__/inbox/receive-route.test.ts`

- [ ] Write tests for unknown token, deleted/suspended/unconfigured Inbox, invalid signature, malformed payload, oversized body, duplicate provider Event ID, duplicate Universal idempotency ID, limit at 100 percent, database failure, and successful acceptance.

- [ ] Implement this transaction order:

```text
1. Hash token and resolve active Inbox.
2. Read at most 1 MiB of raw bytes.
3. Verify source and parse safe provider fields.
4. Return existing Event for an idempotent replay.
5. Reserve one Event in the current usage window.
6. Insert immutable InboxEvent with plan-derived expiresAt.
7. Commit before returning success.
```

- [ ] If insert fails, roll back the usage reservation. If a duplicate race loses, return the winning Event and do not consume a second allowance.

- [ ] Return HTTP `202` with `{ event_id, status: 'received', verification }` for a new Event and HTTP `200` with the same Event ID plus `idempotent_replay: true` for a replay. Return HTTP `429` with `plan_limit_reached` when Event allowance is exhausted.

- [ ] Make the receiving handler `POST` only. Add `Cache-Control: no-store`, request ID, and safe retry guidance. Never echo source request headers or body.

- [ ] Apply receiving limits before body processing: Universal/Generic HMAC/Coolify use 120 requests/minute per Inbox, 240/minute per source IP, and 600/minute per Account; Stripe/GitHub use provider-aware burst limits of 600/minute per Inbox and source IP plus 1,000/minute per Account. The monthly Event allowance still applies after successful validation, and idempotent replays do not consume it.

- [ ] Run `npm test -- __tests__/inbox/receive.test.ts __tests__/inbox/receive-route.test.ts`; expect persistence-before-acknowledgement and rollback tests to pass.

- [ ] Commit:

```bash
git add lib/inbox/receive.ts app/hooks/inbox __tests__/inbox/receive.test.ts __tests__/inbox/receive-route.test.ts
git commit -m "feat: receive durable inbox events"
```

## Task 5: Implement readable Event views without AI-generated summaries

**Files:**

- Create: `lib/inbox/event-presenter.ts`
- Test: `__tests__/inbox/event-presenter.test.ts`

- [ ] Write snapshots for Stripe, GitHub, Coolify, Universal JSON, form, text, and binary Events. Each view must be deterministic and derived only from provider fields.

- [ ] Implement a common view containing source, verification, received time, processing state, expiry, event type, provider event ID, and a bounded metadata table. Add source-specific views such as Stripe object/type, GitHub repository/action/delivery, and Coolify event/resource/status.

- [ ] Put raw body and full allowlisted headers behind an explicit advanced field for authorised owner/Agent callers. Redact any key matching secret/token/password/authorization/cookie patterns before presentation.

- [ ] Assert presenter output contains no `summary`, model call, OpenRouter import, or probabilistic content.

- [ ] Run `npm test -- __tests__/inbox/event-presenter.test.ts`; expect snapshots to pass.

- [ ] Commit:

```bash
git add lib/inbox/event-presenter.ts __tests__/inbox/event-presenter.test.ts
git commit -m "feat: present readable source events"
```

## Task 6: Add checking, bounded waiting, Claims, release, and completion

**Files:**

- Create: `lib/inbox/processing.ts`
- Test: `__tests__/inbox/processing.test.ts`
- Test: `__tests__/inbox/processing-races.test.ts`

- [ ] Write tests for accessible Inbox listing, oldest-Received-first checking, a bounded wait that returns on Event arrival, timeout with no Event, one winner under concurrent Claim calls, Claim renewal not supported, wrong-Agent completion, expired Claim, explicit release, and automatic release.

- [ ] Implement an atomic Claim update that matches `status: 'received'` or an expired processing lease and writes:

```ts
processing: {
  status: 'processing',
  claimId: resourceId('claim_'),
  connectionId: actor.connectionId,
  agentId: actor.agentId,
  claimedAt: now,
  claimExpiresAt: new Date(now.getTime() + 5 * 60_000),
  releaseCount: previous + 0,
}
```

- [ ] Require the current `claimId`, Agent, and unexpired lease for completion. Completion changes only processing fields and records `completedAt`; immutable content remains unchanged.

- [ ] Release changes the Event to Received, clears lease identity, and stores only a safe reason code. Increment expiry/release counters used by Needs attention.

- [ ] Implement `waitForEvent` as bounded database polling with cancellation support, a maximum wait of 25 seconds, and no claim side effect. Do not claim to wake a disconnected runtime.

- [ ] Run `npm test -- __tests__/inbox/processing.test.ts __tests__/inbox/processing-races.test.ts`; expect deterministic clock and race tests to pass.

- [ ] Commit:

```bash
git add lib/inbox/processing.ts __tests__/inbox/processing.test.ts __tests__/inbox/processing-races.test.ts
git commit -m "feat: add recoverable inbox event processing"
```

## Task 7: Register Inbox MCP tools and matching `/v1` operations

**Files:**

- Create: `lib/inbox/operations.ts`
- Modify: `lib/contracts/registry.ts`
- Create: `app/v1/inboxes/route.ts`
- Create: `app/v1/inboxes/[inboxId]/route.ts`
- Create: `app/v1/inboxes/[inboxId]/events/route.ts`
- Create: `app/v1/events/[eventId]/claim/route.ts`
- Create: `app/v1/events/[eventId]/release/route.ts`
- Create: `app/v1/events/[eventId]/complete/route.ts`
- Test: `__tests__/inbox/operations.test.ts`
- Test: `__tests__/inbox/contracts.test.ts`

- [ ] Define and register exactly these Agent operations: `create_inbox`, `list_inboxes`, `get_inbox`, `check_inbox`, `wait_for_event`, `claim_event`, `release_event`, and `complete_event`.

- [ ] Map the HTTP handlers to the same operations. Connection identity comes only from the bearer credential. Ignore and reject any client-supplied `account_id` or acting `agent_id`.

- [ ] Mark list/get/check/wait as read-only MCP operations; create/claim/release/complete are mutating and idempotency metadata must match actual behavior.

- [ ] Regenerate contracts:

```bash
npm run generate:contracts
npm test -- __tests__/inbox/operations.test.ts __tests__/inbox/contracts.test.ts __tests__/contracts
```

Expected: all eight operations appear once in MCP, OpenAPI, docs data, and `llms.txt` with matching schemas.

- [ ] Commit:

```bash
git add lib/inbox/operations.ts lib/contracts/registry.ts app/v1/inboxes app/v1/events public/openapi.json public/llms.txt __tests__/inbox
git commit -m "feat: expose inbox operations to agents"
```

## Task 8: Inbox security and vertical-slice gate

**Files:**

- Create: `__tests__/security/inbox-isolation.test.ts`
- Create: `__tests__/integration/inbox-journey.test.ts`

- [ ] Test two Accounts, two Agents in one Account, grants, reassignment, deleted Inbox behavior, retired receiving tokens, and indistinguishable cross-Account not-found responses.

- [ ] Test the complete journey for all five source modes. Include valid and invalid signatures, duplicate delivery, Agent check/wait, Claim, release, re-Claim, completion, and expiry.

- [ ] Run:

```bash
npm test
npm run check:contracts
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit `0`; the receiving route accepts only intended public input and no Event body appears in logs.

- [ ] Commit:

```bash
git add __tests__/security/inbox-isolation.test.ts __tests__/integration/inbox-journey.test.ts
git commit -m "test: verify inbox delivery and processing"
```
