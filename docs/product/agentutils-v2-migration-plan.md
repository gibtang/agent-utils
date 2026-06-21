# AgentUtils v2 — Migration Plan

**Status:** Canonical migration strategy. Read before touching v1 `/api/*` or v2 `/v1/*`.
**Date:** 2026-06-21
**Scope:** How v2 ships alongside the existing v1 implementation without creating a half-v1/half-v2 hybrid.

This document satisfies the Definition of Done for the migration-plan card.

---

## 1. Migration Decision

**Side-by-side under `/v1`, existing `/api/*` remains temporarily.**

- v2 ships entirely under the `/v1` URL prefix (per PRD §1 base URL).
- v1 `/api/*` routes continue to operate unchanged for existing consumers.
- The two stacks do **not** share code paths, auth, or data models. v1 uses Firebase Auth + `au_` keys; v2 uses its own `agutil_adm_/agt_/apr_` keys + tenant model.
- No breaking change to any current v1 consumer.

**Rationale:** The PRD is a rewrite (new auth model, multi-tenancy, callback signing, idempotency). A greenfield v2 surface alongside v1 avoids data-leak risk during transition and lets existing agents migrate at their own pace. The old surface is retired once usage hits zero.

---

## 2. Current `/api/*` Inventory

### 2.1 Routes (file paths)

| Path | File | v2 equivalent |
|---|---|---|
| `POST /api/dlq`, `GET /api/dlq`, `GET/DELETE /api/dlq/[id]`, `POST /api/dlq/[id]/retry` | `app/api/dlq/route.ts`, `app/api/dlq/[id]/route.ts`, `app/api/dlq/[id]/retry/route.ts` | `app/v1/dlq/[[...id]]/route.ts` + `/claim /release /fail /resolve` |
| `POST /api/checkpoint`, `GET/PUT/DELETE /api/checkpoint/[id]`, `POST /api/checkpoint/[id]/resume`, `GET /api/checkpoint/public/[token]` | `app/api/checkpoint/route.ts`, `app/api/checkpoint/[id]/route.ts`, `app/api/checkpoint/[id]/resume/route.ts`, `app/api/checkpoint/public/[token]/route.ts` | `app/v1/checkpoints/[[...id]]/route.ts` + `/approve /reject` |
| `GET /api/hitl/pending` | `app/api/hitl/pending/route.ts` | `GET /v1/checkpoints?status=pending` |
| `POST /api/upload`, `GET /api/file-host/[id]` | `app/api/upload/route.ts`, `app/api/file-host/[id]/route.ts` | unchanged (image hosting stays; PRD defers Artifact Bus) |
| `GET /api/keys`, `POST /api/keys`, `DELETE /api/keys/[id]` | `app/api/keys/route.ts`, `app/api/keys/[id]/route.ts` | superseded by `POST /v1/tenants`, `POST /v1/agents`, rotate-key endpoints |
| `GET /api/billing/usage`, `POST /api/billing/checkout`, `POST /api/billing/portal` | `app/api/billing/*` | out of v2 MVP scope; billing re-attaches post-MVP |
| `GET /api/health`, `GET /api/docs`, `GET /api/firebase-config`, `GET /api/user`, `POST /api/vercel-ntfy` | misc | v1-only infra; v2 does not need them |

### 2.2 Models

| v1 model | v2 model | notes |
|---|---|---|
| `models/User.ts` | `models/v2/Tenant.ts` | v2 is tenant-scoped, not user-scoped |
| `models/ApiKey.ts` (`au_…`) | `models/v2/ApiCredential.ts` (`agutil_adm_/agt_/apr_`) | hashed; v2 stores hash + resolves identity |
| — | `models/v2/Agent.ts` | new — agent registration |
| `models/KvEntry.ts` | `models/v2/KvEntry.ts` | adds tenantId + namespace + CAS version |
| `models/DeadLetter.ts` | `models/v2/DlqItem.ts` | different status model (failed/claimed/resolved/archived) |
| `models/Checkpoint.ts` | `models/v2/Checkpoint.ts` | adds tenant, approval-proxy, timeout_action |
| `models/AuditLog.ts` | `models/v2/AuditLog.ts` | adds tenant, immutable, request_id |
| — | `models/v2/Schedule.ts` | new — once-callbacks |
| `models/File.ts`, `models/AgentForm.ts`, `models/FormResponse.ts`, `models/Notification.ts`, `models/OtpSession.ts`, `models/PiiSession.ts`, `models/Usage.ts`, `models/WebhookInbox.ts`, `models/WebhookMessage.ts` | — | v1-only; no v2 equivalent in MVP |

### 2.3 Auth & API-key behavior comparison

| Concern | v1 (`/api/*`) | v2 (`/v1/*`) |
|---|---|---|
| Auth | Firebase Auth UID + `au_` keys via `x-api-key` | server-resolved `{tenant_id, agent_id, key_type}` from `agutil_*` keys |
| Identity | per-user (`userId`) | per-tenant + per-agent |
| `tenant_id` source | n/a (single-tenant) | server-derived only — never from body/query/headers |
| Quota | `lib/auth.ts` monthly counter | atomic `Tenant` counter fields (R-QUOTA-2) |
| Rate limit | `lib/rate-limit.ts` per-key KV counter | per-tenant minute bucket on `Tenant.rlBucket/rlCount` |
| Callback signing | none | HMAC-SHA256 over `<ts>.<body>` |
| SSRF protection | none | `lib/v2/callbackSecurity.ts` |
| Idempotency | none | `Idempotency-Key` on creation endpoints |

### 2.4 DLQ / Checkpoint semantics comparison

| Concern | v1 DLQ | v2 DLQ |
|---|---|---|
| Statuses | `pending\|retried\|resolved\|dismissed` | `failed\|claimed\|resolved\|archived` |
| Recovery | `POST /api/dlq/[id]/retry` re-fires webhook | pull-based `/claim /release /fail /resolve`; AgentUtils does not execute retries |
| Scoping | per-user | per-agent within tenant |
| Scheduler coupling | none | independent (DLQ-012) |

| Concern | v1 Checkpoint | v2 Checkpoint |
|---|---|---|
| Approval | anyone with the public token link | admin key or approval-proxy key only; cross-tenant → 404 |
| Callback | none on resolution | signed callback; DLQ cascade on failure |
| Timeout | none | `auto_reject` or `dlq` |

---

## 3. `au_` Key Handling Decision

**Supported during transition, then deprecated.** No automatic migration.

- Existing `au_` keys continue to work against `/api/*` only.
- `au_` keys are **not** valid against `/v1/*`. v2 identity is incompatible by design (no tenant context).
- Migration path for existing users: create a v2 tenant via `POST /v1/tenants`, register agents, rotate their agent scripts to the new keys. This is a manual, documented step — there is no silent data path from Firebase users to tenants because billing/ownership semantics differ.
- Deprecation timeline: announce `/api/dlq`, `/api/checkpoint`, `/api/hitl/*` as deprecated once v2 reaches production parity; remove after telemetry shows zero v1 calls for 30 days.

**No data migration script is required for the MVP** because:
1. v1 DLQ/Checkpoint items use a different status model and per-user scoping — a faithful migration would invent tenant assignments that do not exist.
2. The v1 product has no paying users with critical persisted state yet (per the QA dogfooding roadmap ticket).
3. KV entries are ephemeral agent state that agents can repopulate.

If a real customer needs data preservation, a one-shot script can be written later that: creates a tenant per v1 user, maps their `au_` keys to v2 agent keys, and bulk-inserts their DLQ/Checkpoint rows with `source="migration"`. This is explicitly out of MVP scope.

---

## 4. Data Preservation Decision

**Clean v2 bootstrap. No data migration for MVP.**

- v2 starts with an empty database for its collections (`tenantv2`, `agentv2`, `apicredentialv2`, `kventryv2`, `auditlogv2`, `dlqitemv2`, `schedulev2`, `checkpointv2`, `idempotencykeyv2`).
- v1 collections (`users`, `apikeys`, `kventries`, `deadletters`, `checkpoints`, `auditlogs`, …) are untouched.
- The two coexist in the same MongoDB instance under distinct collection names (the `V2` suffix on every v2 model prevents collisions).

---

## 5. Public Docs / OpenAPI / LLM-discovery Update Plan

v2 and v1 are documented separately so agents do not discover phantom or stale endpoints.

| Artifact | Action |
|---|---|
| `public/openapi.json` | Add a separate `x-agentutils-v2` section (or a second `openapi-v2.json`) covering all `/v1/*` endpoints. Keep v1 paths until deprecated. |
| `public/llms.txt` / `public/llms-full.txt` | Add a v2 section pointing at the new tenant/agent flow and the five tools; mark v1 tool sections "deprecated — use /v1". |
| `public/skill.md` (if mirrored) | Add v2 quick-start; keep v1 reference. |
| `README.md` | Add v2 API table; keep v1 table under a "Legacy" heading. |
| In-app docs (`app/docs/*`) | Add `/docs/v2` page covering tenant signup, agent registration, and the five tools with copy-pasteable curl examples. |

**Phantom-endpoint cleanup:** the existing ticket "16 phantom endpoints in OpenAPI spec" must be resolved by either implementing or removing those v1 OpenAPI entries **before** v2 docs ship, so agents do not conflate the two surfaces.

---

## 6. Conflict List (existing Done tickets / old docs)

Before implementation started, these conflicts were identified and resolved:

1. **Old `/api/dlq` retry semantics vs v2 pull-based DLQ.** Resolved: v2 is pull-based (`/claim /release /fail /resolve`); v1 `/api/dlq/[id]/retry` stays for v1 consumers only.
2. **Old `/api/checkpoint` public-token approval vs v2 approval-proxy.** Resolved: v2 never accepts public tokens; approval requires admin or approval-proxy key. v1 public approval link stays for v1 only.
3. **`au_` key prefix vs `agutil_*` prefix.** Resolved: different prefixes, no overlap; `lib/auth.ts` (v1) and `lib/v2/auth.ts` are independent.
4. **Single `models/KvEntry.ts` vs `models/v2/KvEntry.ts`.** Resolved: v2 model uses the `KvEntryV2` collection name; no schema collision.
5. **"16 phantom endpoints" Done ticket.** Must be fixed independently — it predates v2 and would otherwise pollute the v2 discovery surface.
6. **Old `agentutils-prd-mvp.md` (v1) vs `agentutils-prd-mvp-v2.md`.** v2 PRD explicitly supersedes v1; v1 PRD retained only as historical reference.

---

## 7. Implementation Sequencing Guardrails

To prevent a half-v1/half-v2 hybrid:

1. **Never import v1 lib code into v2 routes.** v2 routes import only from `lib/v2/*` and `models/v2/*`. The single exception is `lib/mongodb.ts` (the shared mongoose connection), wrapped by `lib/v2/db.ts`.
2. **Never import v2 lib code into v1 routes.** v1 routes keep using `lib/auth.ts`, `lib/response.ts`, etc.
3. **The shared mongoose connection is the only legitimate touchpoint.** v2 models register under `*V2` collection names so they cannot collide with v1 collections.
4. **Middleware (`middleware.ts`) does not gate `/v1/*`.** v2 auth is handled inside each route via `lib/v2/auth.ts`. Add `/v1` to the public-paths allowlist so the middleware does not redirect or cookie-check v2 calls.
5. **Deprecate v1 tool routes (`/api/dlq`, `/api/checkpoint`, `/api/hitl/*`) only after v2 parity is verified in production and v1 traffic is zero.** Do not delete v1 routes during the v2 build.
6. **Billing attaches post-MVP.** v2 tenant `plan` is set at creation but not yet enforced by Stripe; v1 billing routes keep running.

---

## 8. Rollout Checklist

- [x] v2 foundation, contract, KV, Audit, DLQ, callbacks, Scheduler, HitL implemented under `/v1/*`.
- [x] Tenant-isolation gate (MT-001..010) and full QA suite pass (127 tests).
- [ ] Add `/v1` to `middleware.ts` public paths so v2 routes are reachable in production.
- [ ] Update `public/openapi.json` with v2 endpoints.
- [ ] Update `public/llms.txt` / `public/llms-full.txt` with v2 quick-start.
- [ ] Add `/docs/v2` in-app documentation page.
- [x] Wire a cron/worker tick that calls `fireDueSchedules()` and `processTimeouts()` on an interval (Next.js route or external scheduler). See `docs/product/agentutils-v2-cron.md` — `POST /v1/tick` is implemented and tested; production wiring is an external cron hitting it (Coolify does not run Next.js cron jobs).
- [ ] Resolve the "16 phantom endpoints" v1 OpenAPI ticket before publishing v2 docs.
- [ ] Announce v1 DLQ/Checkpoint/HITL deprecation once v2 reaches production parity.
- [ ] Remove v1 tool routes after 30 days of zero v1 traffic.
