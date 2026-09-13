# AgentUtils Product Reset Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild AgentUtils around Inbox, State, and Files for non-developer and semi-technical Agent Owners, with MCP as the primary Agent interface, Stripe billing at launch, and Coolify as the production runtime.

**Architecture:** Keep the Next.js, Firebase, MongoDB, Backblaze B2, Docker, and Coolify foundation. Replace the legacy utility collection with feature-local domain services. MCP and `/v1` HTTP handlers invoke the same operation definitions; the same schemas generate OpenAPI, documentation tables, examples, and `llms.txt`. Browser APIs use Firebase owner identity; Agent APIs use hashed, Agent-scoped Connection credentials.

**Tech Stack:** Next.js 16 App Router, TypeScript 5 strict mode, React 19, Mongoose 9, Firebase Auth, Model Context Protocol TypeScript SDK v2, Zod 4, Stripe Node 22, AWS SDK v3 with Backblaze B2, Vitest, MongoDB Memory Server, Playwright, Docker, Coolify.

---

## Source of truth

Read the approved design before executing any child plan:

- `docs/superpowers/specs/2026-09-06-agentutils-product-reset-design.md`
- `CONTEXT.md`
- `docs/adr/0002-*.md` through `docs/adr/0027-*.md`

Current implementation references used when this plan was written:

- [MCP TypeScript SDK server guide](https://ts.sdk.modelcontextprotocol.io/server)
- [Stripe subscription Checkout guide](https://docs.stripe.com/payments/checkout/build-subscriptions)
- [Stripe subscription webhook guide](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe webhook signature guide](https://docs.stripe.com/webhooks/signature)
- [Stripe customer portal guide](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [AWS JavaScript v3 S3 presigner](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/)
- [Coolify scheduled tasks](https://next.coolify.io/docs/core/automation/scheduled-tasks/overview)

Recheck these references before upgrading a major dependency because their APIs can change.

## Plan suite and dependency order

Execute these plans in order. Do not start a dependent plan until its prerequisite test suite passes.

| Order | Plan | Depends on | Deliverable |
|---|---|---|---|
| 1 | `2026-09-06-agentutils-foundation-connections-plan.md` | None | Account, Agent, Connection, pairing, shared contracts, MCP and HTTP foundations |
| 1.5 | `2026-09-13-agentutils-credential-handoff-plan.md` | 1 | Credential Handoff (ADR-0028): possession-only link, per-account DEK encryption, decrypt-on-demand sessions, webhook notify, owner tools |
| 2 | `2026-09-06-agentutils-inbox-plan.md` | 1 | Stable receiving addresses, source verification, immutable Events, Claims |
| 3 | `2026-09-06-agentutils-state-plan.md` | 1 | Private versioned JSON State with explicit same-account grants |
| 4 | `2026-09-06-agentutils-files-plan.md` | 1, then integrate with 2 | Private B2 payload transport, grants, temporary links, Inbox attachments |
| 5 | `2026-09-06-agentutils-billing-lifecycle-plan.md` | 1-4 | Stripe, quotas, usage, retention, Trash, maintenance, notifications |
| 6 | `2026-09-06-agentutils-owner-experience-cleanup-plan.md` | 1-5 | Dashboard, onboarding, marketing site, docs, legacy removal, production verification |

## Canonical implementation vocabulary

Use these names consistently in code, tests, UI, API, and documentation.

| Product term | Type/model | Identifier prefix | Meaning |
|---|---|---|---|
| Account | `Account` | `acct_` | One owner and its billing/security boundary |
| Agent | `Agent` | `agt_` | A named logical autonomous participant |
| Connection | `Connection` | `conn_` | One revocable Agent credential and runtime relationship |
| Pairing Code | `PairingCode` | `pair_` | Single-use, ten-minute bootstrap credential |
| Inbox | `Inbox` | `inbox_` | Stable source-specific event destination |
| Event | `InboxEvent` | `evt_` | Immutable accepted occurrence |
| Claim | embedded in `InboxEvent` | `claim_` | Five-minute processing lease |
| State Record | `StateRecord` | `state_` | Private versioned JSON value |
| File | `FileAsset` | `file_` | Private B2-backed payload metadata |
| Sharing Link | `SharingLink` | `link_` | Revocable, expiring download capability |
| Usage Window | `UsageWindow` | `usage_` | Atomic monthly counters for one Account |
| Activity Record | `ActivityRecord` | `activity_` | Safe metadata-only owner activity entry |

Never use `tenant`, `admin key`, `agent key`, `KV`, `DLQ`, `checkpoint`, `confession`, `scheduler`, or `audit log` in the rebuilt public product language.

## Stable module boundaries

All child plans target this structure:

```text
app/
  api/                    # Firebase-authenticated owner routes and Stripe billing webhook
  hooks/inbox/[token]/    # public inbound source endpoint
  mcp/                    # remote Streamable HTTP MCP endpoint
  v1/                     # advanced Connection-authenticated Agent API
lib/
  accounts/
  activity/
  billing/
  connections/
  contracts/              # operation definitions, registry, schema-derived docs
  core/                   # config, crypto, database, errors, envelopes, IDs, pagination
  files/
  inbox/
  lifecycle/
  mcp/
  notifications/
  owner/
  state/
models/                   # Mongoose persistence only; no business rules
scripts/                  # schema generation and in-container maintenance command
```

Rules:

- Route handlers parse transport concerns and call a domain operation; they do not query Mongoose directly.
- Domain services receive an explicit actor, account boundary, and optional `now` for deterministic tests.
- Every query includes `accountId`; missing resources and cross-account resources return the same `not_found` response.
- Secrets are hashed or encrypted before persistence and redacted from logs.
- Owner-only operations never appear as ordinary MCP tools.
- Resource deletion is immediate in authorization checks, recoverable for seven days where specified, then physically purged.

## Shared contract

Every Agent operation returns either data or this stable error shape:

```ts
export interface PublicErrorBody {
  error: {
    code:
      | 'authentication_required'
      | 'connection_revoked'
      | 'permission_denied'
      | 'source_verification_failed'
      | 'validation_failed'
      | 'payload_too_large'
      | 'plan_limit_reached'
      | 'version_conflict'
      | 'claim_conflict'
      | 'claim_expired'
      | 'resource_deleted'
      | 'resource_expired'
      | 'not_found'
      | 'temporarily_unavailable';
    message: string;
    data_preserved: boolean;
    retry_safe: boolean;
    next_action: string;
    request_id: string;
  };
}
```

HTTP uses the documented status code plus this body. MCP returns the same error fields as structured content and sets `isError: true`. Neither transport returns stack traces, secrets, raw webhook bodies, State values belonging to another Agent, or private B2 object keys.

## Cross-plan invariants

- [ ] Pairing Codes expire after ten minutes and are single-use under concurrent redemption.
- [ ] Connection plaintext credentials are returned once and only their SHA-256 hashes are stored.
- [ ] One Connection acts as one Agent in one Account; it cannot request another identity.
- [ ] Inbox Events are persisted before a success response and their accepted content is immutable.
- [ ] Failed source verification and malformed payloads do not consume Event allowance.
- [ ] Claims are exclusive, last five minutes, and can safely expire or be released.
- [ ] State writes enforce 64 KB per record, compare-and-set, total storage, and explicit grants.
- [ ] B2 objects are private; all upload and download authorization is narrow and short-lived.
- [ ] Free/Plus/Pro limits and retention come from one plan catalogue.
- [ ] The 100 percent hard limit rejects only new usage; existing permitted reads and cleanup remain available.
- [ ] Stripe billing webhooks and customer-source Stripe Inbox webhooks use separate paths and secrets.
- [ ] Deleted resources become inaccessible immediately, remain recoverable for seven days where specified, then purge idempotently.
- [ ] Coolify maintenance can overlap safely and has no public tick endpoint.
- [ ] Public copy contains no unsupported reliability, wake-up, certification, privacy, or integration claims.

## Approved-design coverage map

| Design section | Implementation owner |
|---|---|
| 1-5 Outcome, rationale, audience, scope, delivery boundary | Master plan and final legacy scan |
| 6 Core domain model | Foundation plus each feature's model task |
| 7 Identity, onboarding, permissions | Foundation Tasks 3-8; Owner Experience Task 1 |
| 8 Inbox | Inbox Tasks 1-8 |
| 9 State | State Tasks 1-6 |
| 10 Files | Files Tasks 1-9 |
| 11 Billing and plans | Billing Tasks 1-4 and 9 |
| 12 Retention, Trash, deletion | State Task 4; Files Task 6; Billing Tasks 7-9 |
| 13 Activity and notifications | Billing Task 5 |
| 14 Owner Dashboard | Owner Experience Tasks 1-5 |
| 15 Public website | Owner Experience Tasks 6-8 |
| 16 Interfaces and documentation | Foundation Tasks 6-7; all feature operation tasks; Owner Experience Task 7 |
| 17 Error contract | Foundation Task 2 and every operation contract test |
| 18 Security | Feature security gates and final launch gate |
| 19 Maintenance and Coolify | Billing Task 8 |
| 20 Cleanup | Owner Experience Tasks 8-9 |
| 21 Product measurement | Billing Task 6 |
| 22-23 Verification and acceptance | Every feature gate; Owner Experience Task 10 |
| 24 Delivery sequence | This plan's dependency order |
| 25 Source-informed corrections | Inbox source tests, runtime onboarding, Coolify deployment docs |

## Legacy deletion manifest

Delete these only in the final cleanup plan, after their replacements pass tests. Use `git rm` with these explicit paths; do not delete broad directories containing new work.

```text
app/api/c/
app/api/dashboard/confessions/
app/api/dashboard/keys/
app/api/file-host/
app/api/firebase-config/
app/api/vercel-ntfy/
app/c/
app/docs/audit-log/
app/docs/checkpoint/
app/docs/confessions/
app/docs/dlq/
app/docs/image-upload/
app/docs/kv-store/
app/docs/scheduler/
app/docs/v2/
app/human-in-the-loop/
app/signup/
app/tools/
app/v1/agents/
app/v1/approval-keys/
app/v1/audit/
app/v1/checkpoints/
app/v1/confessions/
app/v1/dlq/
app/v1/kv/
app/v1/schedules/
app/v1/tenants/
app/v1/tick/
app/v1/upload/
components/ConfessionsInbox.tsx
components/GetApiKeyButton.tsx
components/docs/ToolDocPage.tsx
lib/mongodb.ts
lib/storage.ts
lib/dashboard/keynames.ts
lib/dashboard/keys.ts
lib/docs-pages.ts
lib/image-upload.ts
lib/seo-tools.ts
lib/v2/
models/v2/
public/openapi-v2.json
public/file.svg
public/globe.svg
public/next.svg
public/vercel.svg
public/window.svg
scripts/gen-openapi-v2.py
__tests__/lib/dashboard-keys.test.ts
__tests__/lib/image-upload.test.ts
__tests__/lib/keynames.test.ts
__tests__/v2/
PRICING_IMPLEMENTATION_PLAN.md
agent-tool-ideas_2.md
agent-utils-deep-dive.md
docs/plans/2026-04-30-integration-tests.md
docs/product/
docs/superpowers/plans/2026-04-29-file-host-journey-test.md
docs/superpowers/plans/2026-04-29-hitl-combo-journey-test.md
dogfood-output/
openclaw-skills/
screenshots/
scripts/set-plan.mjs
stitch_ai_agent_infrastructure_layer/
test-cases.md
test-debug.mjs
test-google-login-v2.mjs
test-persistent-login.mjs
test-stealth-login.mjs
```

Also remove `twilio`, `@mozilla/readability`, `ajv`, `jsonrepair`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `turndown`, `@types/turndown`, `uuid`, and `@types/uuid` from `package.json` if `rg` confirms no rebuilt code imports them. Replace direct `playwright` use with `@playwright/test` unless retained code still needs the library API. Remove `resend` only if owner notifications are deliberately deferred in a new approved decision; the current design includes Resend notifications.

## Commit boundaries

Use the commit boundaries in each child plan. The intended top-level sequence is:

```text
feat: establish account connection and contract foundation
feat: add inbox event reception and claims
feat: add private versioned agent state
feat: add private file transport
feat: add stripe billing and lifecycle enforcement
feat: rebuild agent owner experience
chore: remove legacy AgentUtils utilities
docs: publish Inbox-first AgentUtils documentation
test: verify AgentUtils launch journey
```

Before every commit:

```bash
npm test
npm run lint
npx tsc --noEmit
git diff --check
```

Expected: all commands exit `0`. The repository's Vitest configuration already runs Mongo-backed test files serially.

## Final verification gate

- [ ] Run `npm test`; expect every domain, integration, contract, and security test to pass.
- [ ] Run `npx playwright test`; expect the approved owner journey to pass on a production build.
- [ ] Run `npm run lint`; expect zero errors and zero warnings.
- [ ] Run `npx tsc --noEmit`; expect no diagnostics.
- [ ] Run `npm run build`; expect a successful standalone production build.
- [ ] Run `docker build -t agentutils:launch .`; expect the image to build successfully.
- [ ] Run the built image with non-production test services and call `/api/health`; expect HTTP `200` without secret values.
- [ ] Run `npm run maintenance:dry-run`; expect a zero-exit summary with no mutations.
- [ ] Run `npm run generate:contracts`, then `git diff --exit-code`; expect no generated drift.
- [ ] Run `rg -n "Checkpoint|Confession|Dead Letter|DLQ|Scheduler|Audit Log|KV Store|Image Upload|agentutils\\.dev|Vercel" app components lib public README.md next.config.ts package.json`; expect no product-surface matches. Infrastructure migration notes under `docs/adr` and the approved design are exempt.
- [ ] Run `rg -n "agutil_adm_|agutil_agt_|adminKey|apiKey" app components lib models`; expect no legacy plaintext-key implementation.
- [ ] Run `rg -n "TODO|FIXME|TBD|placeholder|implement later" app components lib models scripts __tests__`; inspect every match and remove unfinished launch work.
- [ ] After explicit deployment approval, manually verify a Coolify scheduled task with command `npm run maintenance`, frequency `* * * * *`, a sixty-second timeout, and the correct application container.
- [ ] After explicit live-configuration approval, confirm the live Stripe webhook endpoint uses the billing webhook secret and cannot accept an Inbox endpoint secret.
- [ ] Confirm the B2 bucket has no public read policy and a revoked Sharing Link no longer yields a download authorization.

## Launch acceptance journey

The release is incomplete until one person who did not build the product can complete this flow using the production-like deployment:

1. Open the homepage and understand that AgentUtils gives an AI Agent an inbox for outside events.
2. Sign in with Google.
3. Ask Codex or Hermes to connect using the displayed ten-minute Pairing Code.
4. Complete only the runtime-required restart or confirmation and see the Connection become active.
5. Ask the Agent to create an Inbox.
6. Follow the plain-language Stripe, GitHub, Coolify, or Universal setup instructions.
7. Send a test Event, see Verified or Unverified accurately, and have the Agent claim and complete it.
8. Set and retrieve one State Record, including one deliberate version conflict.
9. Upload, share, download, revoke, and delete one File without exposing a permanent public URL.
10. Upgrade through Stripe Checkout and see the new plan limits after the signed billing webhook is processed.
11. Open the billing portal and return to AgentUtils.
12. Delete and restore a resource from Trash, then confirm permanent purge after the test clock advances.

Record the tester, date in `DD-Mmm-YYYY` form, environment, observed result, and links to any defects in `docs/launch/acceptance.md`. Code execution does not authorize a production or staging deployment by itself; obtain explicit approval before changing Coolify, Stripe, DNS, or other external configuration.
