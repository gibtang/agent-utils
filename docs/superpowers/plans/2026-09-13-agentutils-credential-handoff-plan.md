# AgentUtils Credential Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Credential Handoff capability (ADR-0028): a Connection-authenticated agent declares a credential request, a human fills a possession-only public link, values are encrypted at rest under a per-account DEK, and the creating agent decrypts on demand until closure — with owner list/revoke/audit tools and zero secret display anywhere.

**Architecture:** A `Handoff` document owns a two-scope link (hash-only view + single-use submit tokens), a declared field schema, and an AES-256-GCM envelope over the per-account DEK. The public `/h/[id]` route resolves tokens by SHA-256 lookup only. Submission is a conditional update (race-safe), notifies via SSRF-guarded signed HMAC webhook, and opens a 24h decrypt window. All agent operations enforce the creating-Connection identity; all queries include `accountId` with uniform `not_found` behavior.

**Tech Stack:** Next.js route handlers, TypeScript strict, Zod, Mongoose, Node crypto (AES-256-GCM, HMAC, timingSafeEqual), Stripe-era plan catalogue for quotas, Vitest + MongoDB Memory Server.

**Depends on:** `2026-09-06-agentutils-foundation-connections-plan.md` (Account, Agent, Connection, contracts, core crypto/errors/ids). Slots into the master suite after plan 1 as plan 1.5. Webhook notify means plan 2 (Inbox) is NOT a prerequisite.

---

## Task 1: Model Handoffs and the per-account DEK

**Files:**

- Create: `models/Handoff.ts`
- Create: `lib/handoff/crypto.ts`
- Create: `lib/handoff/schemas.ts`
- Test: `__tests__/handoff/models.test.ts`

- [ ] Write schema tests for `Handoff`: `handoffId` (`cv_` + ULID), `accountId`, `agentId` + `connectionId` (creator), `status` (`awaiting` | `submitted` | `closed` | `expired`), `closureReason` (`done` | `revoked` | null), `fieldSchema` (validated array, max 12), `viewTokenHash`/`submitTokenHash`, `linkExpiresAt`, `sessionExpiresAt`, `retrievalCount`, `lastRetrievedAt`, `callbackUrl` + `callbackSecretHash`, `submitIpHash`, `expiresAtPurge`. Indexes: token-hash lookups, account/status listing, purge TTL.

- [ ] Assert only SHA-256 hashes of link tokens and the callback secret are stored; plaintext exists nowhere at rest. Assert `fieldSchema` field types are limited to `email | text | password | textarea` (no `otp`); `password` fields reject `prefill`; names match `^[a-z0-9_]{1,64}$`, unique; labels ≤ 120 chars; `helpText` ≤ 240.

- [ ] Implement `lib/handoff/crypto.ts`: `encryptHandoffValues(dekHex, values)` / `decryptHandoffValues(dekHex, envelope)` with AES-256-GCM (fresh 12-byte IV, base64 ciphertext/iv/tag); `generateHandoffDek()`; `generateHandoffViewToken()` (`htv_`), `generateHandoffSubmitToken()` (`hts_`); SHA-256 `hashHandoffToken()`. Account model gains `handoffDek` (generated lazily on first handoff; backfill existing accounts on first use).

- [ ] Write tamper tests: modified ciphertext, wrong IV/tag, and wrong DEK each fail decryption and never return plaintext.

- [ ] Run `npm test -- __tests__/handoff/models.test.ts`; expect green. Commit: `feat: model credential handoffs and account dek`

## Task 2: Handoff domain service — create, submit, decrypt, close, expire

**Files:**

- Create: `lib/handoff/service.ts`
- Test: `__tests__/handoff/service.test.ts`

- [ ] Implement `createHandoff(actor, {fieldSchema, title?, linkTtlHours?, callbackUrl?})`: validates schema, generates tokens, returns the one-time `viewToken` + `submitToken` + link path. `submitHandoffValues(plaintextToken, values, {ipHash})`: resolves by hash, validates values against the declared schema (exact key set, required enforcement, email format, 4096-char cap), encrypts, and transitions `awaiting → submitted` via conditional `updateOne` — a concurrent double-submit must yield exactly one success. Failures never consume the submit token.

- [ ] Implement `decryptHandoff(handoffId, actor)`: 404 for any non-creator agent or cross-account id (uniform `not_found`), `resource_expired` past session TTL, plain-object values otherwise; increments `retrievalCount`, sets `lastRetrievedAt`. `closeHandoff(handoffId, actor, reason)`: creator Connection (`done`) or owner (`revoked`); nulls ciphertext, IV, tag, and both token hashes; sets `closedAt` + purge deadline. `expireStaleHandoffs(now)` for the maintenance task: expired sessions and lapsed links crypto-erase.

- [ ] Use only reset error codes: `validation_failed`, `not_found`, `resource_expired`, `resource_deleted`, `permission_denied`, `authentication_required`. Every operation accepts an injected `now` for deterministic tests.

- [ ] Service tests: race-safe submit; creator-only decrypt (second Connection in the same account 404s); owner close on a submitted handoff; done-close requires creator; crypto-erasure assertions on both close paths and both expiry paths; failure submissions leave the token reusable.

- [ ] Run `npm test -- __tests__/handoff/service.test.ts`; expect green. Commit: `feat: handoff lifecycle service with crypto-erasure`

## Task 3: Signed webhook notification (D7, SSRF-guarded)

**Files:**

- Create: `lib/handoff/notify.ts`
- Test: `__tests__/handoff/notify.test.ts`

- [ ] Implement submission notice: build minimal payload `{event: 'handoff.submitted', handoffId, accountId, submittedAt}` — never field values, never the DEK, never tokens. Sign `v1=<hex>` HMAC-SHA256 over `timestamp.body` with a per-connection callback secret. POST with 10s timeout; classify outcomes; on final failure record a safe metadata-only activity entry (reset has no DLQ concept — do not invent one).

- [ ] SSRF guard before any request: resolve DNS, reject private/loopback/link-local/metadata ranges and non-https; no redirect following. Contract test the guard against a local listener.

- [ ] Notify tests: signature verifies with the shared secret and fails with a wrong one; payload contains only allowed keys; private-range callback URL is blocked before connection; timeout/failure path records activity without throwing.

- [ ] Run `npm test -- __tests__/handoff/notify.test.ts`; expect green. Commit: `feat: signed ssrf-guarded handoff webhook notify`

## Task 4: v1 HTTP + MCP operations

**Files:**

- Create: `app/v1/handoffs/route.ts`, `app/v1/handoffs/[id]/route.ts`, `app/v1/handoffs/[id]/decrypt/route.ts`, `app/v1/handoffs/[id]/close/route.ts`
- Create: `lib/handoff/operations.ts` (shared contract: Zod schemas → OpenAPI + MCP tool definitions)
- Test: `__tests__/handoff/contract.test.ts`

- [ ] Wire routes as thin transports: Connection auth → operation call → envelope. `POST /v1/handoffs` (returns tokens once), `GET /v1/handoffs` (list, metadata only), `POST /v1/handoffs/[id]/decrypt`, `POST /v1/handoffs/[id]/close`, `GET /v1/handoffs/[id]` (status poll — universal fallback to webhook). Owner routes under `/api/`: list/revoke/audit — never decrypt.

- [ ] One shared operation definition per capability generates the OpenAPI entry and the MCP tool (`handoff_create`, `handoff_decrypt`, `handoff_close`, `handoff_status`) — no divergent surfaces. Decrypt responses are returned only to the creating Connection; MCP output uses the same redaction rules.

- [ ] Contract tests: error-shape conformance for every endpoint; permission matrix (creator vs other-Connection vs owner vs unauthenticated); response bodies contain no ciphertext, tokens, hashes, or DEK material; poll returns status transitions.

- [ ] Run `npm test -- __tests__/handoff/contract.test.ts`; expect green. Commit: `feat: handoff v1 routes and mcp operations`

## Task 5: Public handoff form `/h/[id]`

**Files:**

- Create: `app/h/[id]/page.tsx`, `app/h/[id]/actions.ts`
- Create: `components/handoff/HandoffForm.tsx`
- Create: `app/api/handoff-submit/route.ts`
- Test: `__tests__/handoff/public-form.test.ts`

- [ ] Render the declared schema generically: `password` = masked + double-entry confirm, `email` = type-validated, `text`/`textarea` plain; show `label`/`helpText`/`prefill`. Expired/used/invalid/unknown tokens render a neutral terminal state with no markup probing (same opaque behavior for all failure modes). No page-source, JS-state, or network secret leakage post-submit; masked-only confirmation (no value echo).

- [ ] Abuse controls (D9): honeypot field, per-IP rate limit + per-handoff attempt counter, `submitIpHash` = SHA-256 of IP (never the IP), no CAPTCHA. Every attempt (success or failure) writes metadata-only activity.

- [ ] Form tests: happy path (fill → submit → masked confirmation), double-submit blocked, honeypot trip, rate-limit trip, each terminal state renders, no value echo.

- [ ] Run `npm test -- __tests__/handoff/public-form.test.ts`; expect green. Commit: `feat: public handoff form with abuse controls`

## Task 6: Owner dashboard section + launch gate

**Files:**

- Create: `app/dashboard/handoffs/page.tsx`, `components/handoff/HandoffsSection.tsx`
- Test: `__tests__/handoff/dashboard.test.ts`

- [ ] Owner list (status, age, creator agent, last event, retrieval count), revoke with explicit crypto-erase consequence copy, per-handoff audit view (activity events only — never content). Zero secret display: assert no route, component, or log line renders ciphertext or plaintext values.

- [ ] Full-suite gate: `npm test` green; `npx tsc --noEmit` clean; `npm run lint` clean; `rg -n "agutil_|adminKey|tenantId" lib/handoff models/Handoff.ts app/v1/handoffs` returns nothing (legacy vocabulary check per master plan); add the capability to the master plan verification scan if named vocabulary is flagged.

- [ ] Run `npm test -- __tests__/handoff/dashboard.test.ts`; expect green. Commit: `feat: owner dashboard handoff section`

---

## Sequencing note

Executes after plan 1 (Foundation/Connections) passes its suite; independent of plan 2 (Inbox) because notify is webhook-based. Re-serialize in the master plan suite if notify is later switched to Inbox Events (then this becomes plan 3 and State/Files/Billing shift).
