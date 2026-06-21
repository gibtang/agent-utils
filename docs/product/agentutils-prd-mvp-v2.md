# AgentUtils — MVP Product Requirements Document

**Version:** MVP v2 (multi-tenant SaaS, startup-focused)  
**Status:** Canonical implementation spec for AgentUtils v2 — this is a v2 architecture/rewrite, not an incremental patch to the current `/api/*` Mongo/Firebase implementation. Supersedes agentutils-prd-v1.md and agentutils-prd-v2-multitenant.md  
**Audience:** Coding agent (implementation), QA agent (test case generation)  
**Tools in scope:** KV Store, Scheduler, Dead Letter Queue, Audit Log, HitL Checkpoint  
**Tools deferred:** Artifact Bus (v1.1), Webhook Inbox, PII Shield, Secret Store (v2)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals](#2-goals)
3. [Non-Goals MVP](#3-non-goals-mvp)
4. [Architecture](#4-architecture)
5. [API Conventions](#5-api-conventions)
6. [Security Requirements](#6-security-requirements)
7. [Tenant Management](#7-tenant-management)
7. [Agent Registration](#7-agent-registration)
8. [Tool: KV Store](#8-tool-kv-store)
9. [Tool: Scheduler](#9-tool-scheduler)
10. [Tool: Dead Letter Queue](#10-tool-dead-letter-queue)
11. [Tool: Audit Log](#11-tool-audit-log)
12. [Tool: HitL Checkpoint](#12-tool-hitl-checkpoint)
13. [Multi-Agent and Multi-Tenant Edge Cases](#13-multi-agent-and-multi-tenant-edge-cases)
14. [Definition of Done](#14-definition-of-done)
15. [Glossary](#15-glossary)

---

## 1. Overview

AgentUtils is a standalone HTTP API service providing shared infrastructure primitives for autonomous AI agents running across heterogeneous runtimes (Hermes, Claude Code, OpenAI Codex, OpenClaw, and others). It is runtime-agnostic: any agent that can make HTTP calls can use it.

**The problem it solves:** agents running multi-hour autonomous workflows across multiple sessions need reliable state persistence, failure capture, async human approval, and self-scheduling. None of these are adequately served by in-session memory, in-chat primitives, or human-managed cron jobs.

AgentUtils is offered as a multi-tenant cloud service. Each user (tenant) gets isolated infrastructure. Tenant A's agents cannot see, modify, or interfere with Tenant B's data under any circumstances.

**Base URL:** `https://api.agentutils.io` (configurable via `AGENTUTILS_BASE_URL`)  
**API version prefix:** `/v1`  
**Full base:** `https://api.agentutils.io/v1`

---

## 2. Goals

- G1: Provide a single HTTP API surface all agent runtimes can call identically
- G2: Enable agents to schedule their own future continuations without external cron dependency
- G3: Capture all async failures durably so nothing is lost silently
- G4: Allow agents to persist precise, structured state across session boundaries
- G5: Record an immutable audit trail of all agent actions within a tenant
- G6: Enable human approval of risky agent actions without blocking the agent in-session
- G7: Be safe under concurrent access by multiple agents within the same tenant
- G8: Guarantee complete data isolation between tenants — no cross-tenant leakage under any circumstances
- G9: Support multiple tenants on shared infrastructure with fair resource distribution via per-tenant quotas

---

## 3. Non-Goals MVP

- No Artifact Bus — deferred to v1.1. Workaround: store pre-signed S3 URLs in KV.
- No Webhook Inbox — v2
- No PII Shield — v2
- No Secret Store — v2
- No recurring / cron schedules — external triggers start jobs; agents self-schedule `once` continuations
- No agent-to-agent direct messaging
- No dashboard UI — API only; Telegram bot integration is a layer on top
- No cross-tenant resource sharing — a tenant's resources are never accessible to another tenant
- No tenant data export (GDPR) — added when first EU customer requests it
- No Enterprise plan — Free and Pro only at launch

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Agent Runtimes (per tenant)                 │
│   Hermes │ Claude Code │ Codex │ OpenClaw │ Others           │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP/JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│               AgentUtils HTTP API (/v1)                      │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Auth + Tenant Resolution Layer                       │  │
│  │  API key → (tenant_id, agent_id, key_type)            │  │
│  │  All downstream queries: WHERE tenant_id = ?          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│       KV │ Scheduler │ DLQ │ Audit Log │ HitL               │
└──────────────────────────┬───────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
       Persistence                  Internal
       (datastore)                 Job Runner
       tenant_id column            (scheduler fire,
       on every table              DLQ lock expiry,
                                   audit write queue)
```

**Core isolation guarantee:** `tenant_id` is resolved from the API key server-side before any query executes. This enforcement is at the ORM/query-builder layer — not in individual tool handlers — so it cannot be bypassed. No query may touch a row whose `tenant_id` differs from the resolved `tenant_id`.

**Persistence:** pluggable storage layer (SQLite for local dev, Postgres for production). PRD is storage-agnostic.

**Internal job runner:** handles scheduler callback delivery, DLQ lock expiry (returning timed-out items to `pending`), and async audit log writes. It is a single deployable service alongside the API.

---

## 5. API Conventions

### 5.1 Authentication

Two principal types exist:

**Tenant admin key** (prefix `agutil_adm_`)
- Used for tenant management and agent registration
- Presented via `X-Admin-Key` header
- Does not require `X-Agent-Id`

**Agent key** (prefix `agutil_agt_`)
- Used for all five tool endpoints
- Presented via `X-Api-Key` header, paired with `X-Agent-Id`

**Agent tool call headers:**
```
X-Agent-Id: rx0
X-Api-Key: agutil_agt_a1b2c3...
```

**Tenant admin call headers:**
```
X-Admin-Key: agutil_adm_z9y8x7...
```

**Resolution logic (server-side, mandatory):**
1. Extract key from header
2. Hash and look up in `api_keys` table
3. Retrieve `{tenant_id, agent_id, key_type}` — never trust caller-supplied values
4. For agent keys: validate `X-Agent-Id` matches `agent_id` in the record
5. Inject `tenant_id` into all downstream queries as an implicit filter
6. Any failure at any step: `401 INVALID_CREDENTIALS`

**`tenant_id` is NEVER accepted from request body, query params, or headers.** Always server-derived. This is the single most important rule in the system.

### 5.2 Request Format

- All request bodies: `Content-Type: application/json`
- All timestamps in request bodies: ISO 8601 UTC (e.g., `2025-01-15T10:30:00Z`)

### 5.3 Response Format

**Success (single resource):**
```json
{
  "data": { },
  "meta": { "request_id": "req_01JXYZ" }
}
```

**Success (list):**
```json
{
  "data": [ ],
  "meta": {
    "request_id": "req_01JXYZ",
    "cursor": "cursor_token_abc",
    "has_more": true
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "KEY_NOT_FOUND",
    "message": "Human-readable description",
    "details": { },
    "request_id": "req_01JXYZ"
  }
}
```

### 5.4 HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success (GET, PATCH, non-creation POST) |
| 201 | Created |
| 204 | Success, no body (DELETE) |
| 400 | Validation error |
| 401 | Auth failure |
| 402 | Tenant suspended |
| 403 | Authenticated but not authorised |
| 404 | Not found |
| 409 | Conflict |
| 410 | Gone (tenant deleted or tombstoned resource only; expired KV keys return 404 in MVP) |
| 413 | Payload too large |
| 422 | Unprocessable (semantic error) |
| 429 | Rate limited or quota exceeded |
| 500 | Internal error |

### 5.5 Pagination

All list endpoints use cursor-based pagination:
- Request: `?cursor=<token>&limit=<n>` (default 20, max 100)
- Response: `meta.cursor` is the next-page token; `meta.has_more` is boolean
- Omit `cursor` for first page

### 5.6 Rate Limits

Rate limits are per-tenant across all agents combined.

| Plan | Requests/minute |
|---|---|
| Free | 60 |
| Pro | 1,000 |

Response headers on every request:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 43
X-RateLimit-Reset: 1705318860
```

Rate limit exceeded response: `429 RATE_LIMITED` with `retry_after_seconds` in error details.

### 5.7 Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `MISSING_AUTH_HEADERS` | 401 | Required auth header absent |
| `INVALID_CREDENTIALS` | 401 | Key does not match agent or is invalid |
| `ADMIN_KEY_REQUIRED` | 403 | Endpoint requires admin key |
| `FORBIDDEN` | 403 | Authenticated but not authorised for this resource |
| `NOT_FOUND` | 404 | Resource does not exist |
| `GONE` | 410 | Tenant deleted or tombstoned resource only |
| `TENANT_SUSPENDED` | 402 | Tenant account is suspended |
| `TENANT_DELETED` | 410 | Tenant has been deleted |
| `VALIDATION_ERROR` | 400 | Request body fails validation |
| `PAYLOAD_TOO_LARGE` | 413 | Body exceeds size limit |
| `CONFLICT` | 409 | State conflict |
| `RATE_LIMITED` | 429 | Per-minute rate limit exceeded |
| `QUOTA_EXCEEDED` | 429 | Tenant resource quota exceeded |
| `KEY_NOT_FOUND` | 404 | KV key does not exist |
| `VERSION_MISMATCH` | 409 | CAS write failed — version conflict |
| `NAMESPACE_FORBIDDEN` | 403 | Agent cannot access this KV namespace |
| `SCHEDULE_NOT_FOUND` | 404 | Schedule ID does not exist |
| `SCHEDULE_ALREADY_CANCELLED` | 409 | Schedule already cancelled |
| `SCHEDULE_LIMIT_EXCEEDED` | 429 | Deprecated alias for `QUOTA_EXCEEDED`; do not use in new responses |
| `DLQ_ITEM_NOT_FOUND` | 404 | DLQ item does not exist |
| `DLQ_ITEM_LOCKED` | 409 | Item already claimed — includes `locked_until` in details |
| `DLQ_ITEM_ALREADY_RESOLVED` | 409 | Item already resolved or archived |
| `CHECKPOINT_NOT_FOUND` | 404 | Checkpoint does not exist |
| `CHECKPOINT_ALREADY_RESOLVED` | 409 | Checkpoint already approved, rejected, or expired |
| `CHECKPOINT_LIMIT_EXCEEDED` | 429 | Deprecated alias for `QUOTA_EXCEEDED`; do not use in new responses |
| `AGENT_NAME_TAKEN` | 409 | Agent name already exists in this tenant |
| `TENANT_NAME_TAKEN` | 409 | Tenant name already registered |
| `INTERNAL_ERROR` | 500 | Internal server error |

### 5.8 Per-Tenant Resource Quotas

| Resource | Free | Pro |
|---|---|---|
| Max agents | 3 | 50 |
| Max KV keys (total, all namespaces) | 5,000 | 100,000 |
| Max KV storage | 10 MB | 2 GB |
| Max active schedules (total, all agents) | 10 | 1,000 |
| Max DLQ items retained | 500 | 20,000 |
| Audit log retention | 7 days | 30 days |
| Max pending HitL checkpoints (total, all agents) | 5 | 50 |

**Quota rules:**
- R-QUOTA-1: When a tenant exceeds a quota, the creation operation returns `429 QUOTA_EXCEEDED` with the quota type in `details.quota`. Reads and deletes MUST continue to work even over quota.
- R-QUOTA-2: Quota checks MUST be atomic. Use database-level constraints or atomic counters. A limit of 50 checkpoints MUST NOT be exceeded by 51 concurrent creation requests all passing the check simultaneously.
- R-QUOTA-3: Free plan tenants inactive for 90 days (no API calls) have their data purged with 14 days email notice.

---

## 6. Security Requirements

### 6.1 Signed callbacks

All outbound callbacks from Scheduler and HitL MUST be signed. AgentUtils adds these headers to every callback request:

```http
X-AgentUtils-Event: schedule.fired|checkpoint.resolved
X-AgentUtils-Timestamp: 2025-01-15T11:30:02Z
X-AgentUtils-Signature: v1=<hex_hmac_sha256>
X-AgentUtils-Delivery-Id: del_01JXYZ
```

Signature base string: `<timestamp>.<raw_request_body>`. Signature algorithm: HMAC-SHA256 using the tenant or agent callback secret. Receivers MUST reject callbacks where the timestamp is outside the configured replay window or the signature does not match.

### 6.2 Callback SSRF protection

Any user-provided callback URL (`callback_url`, `callback_base_url`, and equivalent future fields) MUST pass SSRF validation before storage and immediately before delivery.

MVP policy:
- HTTPS only.
- Do not follow redirects.
- Resolve DNS and reject loopback, localhost, `0.0.0.0`, private RFC1918 ranges, link-local ranges, multicast/reserved ranges, and metadata endpoints such as `169.254.169.254`.
- Re-check resolved IP at delivery time to reduce DNS rebinding risk.
- Return `400 VALIDATION_ERROR` for rejected callback URLs.

### 6.3 Idempotency

Creation endpoints MUST support `Idempotency-Key` so agents can safely retry after transport failures. Minimum MVP coverage:

- `POST /v1/tenants`
- `POST /v1/agents`
- `POST /v1/schedules`
- `POST /v1/dlq`
- `POST /v1/audit`
- `POST /v1/checkpoints`

Idempotency keys are scoped by tenant and endpoint. Reusing the same key with the same request body returns the original response. Reusing it with a different body returns `409 CONFLICT`.

### 6.4 Storage and callback delivery guarantees

Durability claims only apply after the primary datastore accepts the write. If durable storage is unavailable, endpoints return `500 INTERNAL_ERROR` and emit an internal alert. The PRD must not claim writes are impossible to fail.

---

## 6. Tenant Management

### 6.1 Create Tenant

Public endpoint — no authentication required.

```
POST /v1/tenants
```

**Request body:**
```json
{
  "name": "acmecorp",
  "owner_email": "founder@acmecorp.com",
  "plan": "free"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | yes | 3–32 chars, lowercase alphanumeric and hyphens, globally unique |
| `owner_email` | string | yes | Valid email, used for billing and suspension notices |
| `plan` | enum | yes | `"free"` or `"pro"` |

**Response 201:**
```json
{
  "data": {
    "tenant_id": "ten_01JXYZ",
    "name": "acmecorp",
    "owner_email": "founder@acmecorp.com",
    "plan": "free",
    "status": "active",
    "admin_key": "agutil_adm_a1b2c3d4...",
    "created_at": "2025-01-15T08:00:00Z"
  }
}
```

- `admin_key` is shown **once** at creation. If lost, use the rotate-key endpoint.
- `409 TENANT_NAME_TAKEN` if name already registered.

### 6.2 Get Tenant

```
GET /v1/tenants/{tenant_id}
```

Requires `X-Admin-Key`. Returns tenant metadata with masked admin key and current quota usage.

**Response 200:**
```json
{
  "data": {
    "tenant_id": "ten_01JXYZ",
    "name": "acmecorp",
    "plan": "free",
    "status": "active",
    "quota_usage": {
      "agents": { "used": 2, "limit": 3 },
      "kv_keys": { "used": 312, "limit": 5000 },
      "kv_storage_bytes": { "used": 45000, "limit": 10485760 },
      "schedules_active": { "used": 3, "limit": 10 },
      "dlq_items": { "used": 7, "limit": 500 },
      "checkpoints_pending": { "used": 1, "limit": 5 },
      "audit_retention_days": 7
    },
    "created_at": "2025-01-15T08:00:00Z"
  }
}
```

### 6.3 Rotate Admin Key

```
POST /v1/tenants/{tenant_id}/rotate-key
```

Requires `X-Admin-Key`. Returns new `admin_key` in full once. Old key invalidated immediately.

### 6.4 Delete Tenant

```
DELETE /v1/tenants/{tenant_id}
```

Requires `X-Admin-Key`. Request body MUST include `{"confirm": "DELETE ALL DATA"}` exactly. Without it: `400 VALIDATION_ERROR`.

- Tenant status moves to `pending_deletion`
- All API calls immediately return `410 TENANT_DELETED`
- All tenant data purged within 24 hours
- Irreversible

**Response 204** on success.

### 6.5 Tenant Lifecycle

```
[signup] → active
active   → suspended       (billing failure)
active   → pending_deletion (owner calls DELETE)
suspended → active          (billing resolved — internal billing system call only)
suspended → pending_deletion (90 days unpaid)
pending_deletion → deleted  (data purged within 24 hours)
```

| Status | Tool API calls | Scheduled jobs | Data |
|---|---|---|---|
| `active` | Normal | Fire normally | Retained |
| `suspended` | `402 TENANT_SUSPENDED` | Paused | Retained |
| `pending_deletion` | `410 TENANT_DELETED` | Stopped | Retained until purge |
| `deleted` | `410 TENANT_DELETED` | N/A | Purged |

When a suspended tenant is reactivated: `once` schedules whose `fire_at` has passed are gone (missed windows do not backfire). Scheduled jobs resume only for future `fire_at` values.

---

## 7. Agent Registration

Requires `X-Admin-Key`. Agent names are unique within a tenant — the same name can exist in different tenants.

### 7.1 Register Agent

```
POST /v1/agents
X-Admin-Key: agutil_adm_...
```

**Request body:**
```json
{
  "name": "rx0",
  "description": "Orchestrator and coding agent",
  "callback_base_url": "https://hermes.internal/agents/rx0"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | yes | 3–32 chars, lowercase alphanumeric and hyphens, unique within tenant |
| `description` | string | no | max 256 chars |
| `callback_base_url` | string | no | valid HTTPS URL, used as default callback base |

**Response 201:**
```json
{
  "data": {
    "agent_id": "rx0",
    "tenant_id": "ten_01JXYZ",
    "api_key": "agutil_agt_x1y2z3...",
    "callback_base_url": "https://hermes.internal/agents/rx0",
    "created_at": "2025-01-15T08:00:00Z"
  }
}
```

- `api_key` is shown **once** at registration.
- `409 AGENT_NAME_TAKEN` if name already exists in this tenant.
- `429 QUOTA_EXCEEDED` if tenant is at agent limit.

### 7.2 Get Agent Info

```
GET /v1/agents/{agent_id}
X-Admin-Key: agutil_adm_...
```

Returns agent metadata with masked API key. Any agent within the same tenant can also call this with their agent key.

### 7.3 Rotate Agent Key

```
POST /v1/agents/{agent_id}/rotate-key
X-Admin-Key: agutil_adm_...
```

Returns new `api_key` in full once. Old key invalidated immediately.

---

## 8. Tool: KV Store

### 8.1 Purpose

Deterministic key-value state store. Provides precise, structured state that survives session boundaries: idempotency keys, job cursors, build hashes, counters, flags, and coordination between agents.

**Not a substitute for memory.** Memory is fuzzy and semantic. KV is exact and deterministic. Use KV when correctness of retrieval is required.

### 8.2 Namespace Model

- `/v1/kv/{agent_id}/{key}` — private to the owning agent within the tenant
- `/v1/kv/shared/{key}` — readable and writable by all agents within the same tenant

An agent cannot access another agent's private namespace within the same tenant. Attempts return `403 NAMESPACE_FORBIDDEN`. The `shared` namespace is scoped per-tenant — it does not cross tenant boundaries.

### 8.3 Key Format

- Max length: 512 bytes
- Allowed characters: `[a-zA-Z0-9:._-]` — colons recommended as hierarchy separators (e.g., `job:pr123:status`)
- Case-sensitive

### 8.4 Endpoints

#### GET /v1/kv/{namespace}/{key}

**Response 200:**
```json
{
  "data": {
    "key": "job:pr123:status",
    "namespace": "rx0",
    "value": "awaiting_review",
    "ttl_seconds": 3600,
    "expires_at": "2025-01-15T11:00:00Z",
    "version": 4,
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
}
```

- `404 KEY_NOT_FOUND` if key does not exist
- Expired keys are treated as absent in MVP: `404 KEY_NOT_FOUND`. Do not return `410 GONE` unless tombstones are implemented later.

#### PUT /v1/kv/{namespace}/{key}

Upsert — creates if not exists, overwrites if exists.

**Request body:**
```json
{
  "value": "awaiting_review",
  "ttl_seconds": 3600
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `value` | any JSON | yes | serialised max 100KB |
| `ttl_seconds` | integer | no | 0 = no expiry, max 2592000 (30 days) |

**Unconditional write:** no `If-Match` header = last-write-wins regardless of version.

**CAS write:** add `If-Match: <version>` header for optimistic concurrency control.
- Version matches: write succeeds, version increments by 1
- Version does not match: `409 VERSION_MISMATCH` with `{"current_version": N}` in details
- `If-Match: 0` on non-existent key: creates it (atomic create-only guard)
- `If-Match: 0` on existing key: `409 CONFLICT`

**Response 200:**
```json
{
  "data": {
    "key": "job:pr123:status",
    "namespace": "rx0",
    "version": 5,
    "expires_at": "2025-01-15T11:00:00Z",
    "updated_at": "2025-01-15T10:01:00Z"
  }
}
```

#### DELETE /v1/kv/{namespace}/{key}

Returns `204` on success, `404` if key not found.

#### GET /v1/kv/{namespace}

List keys in a namespace. Query params: `?prefix=job:pr123:&cursor=xxx&limit=50`

Returns key names, expiry times, and versions. Does not return values. Excludes expired keys.

### 8.5 Data Model

| Field | Type | Notes |
|---|---|---|
| `key` | string | Key within namespace |
| `namespace` | string | agent_id or `"shared"` |
| `value` | any JSON | Stored as JSON |
| `ttl_seconds` | integer\|null | null = no expiry |
| `expires_at` | ISO 8601\|null | null if no TTL |
| `version` | integer | Starts at 1, increments on every write |
| `created_at` | ISO 8601 | Set on first write only |
| `updated_at` | ISO 8601 | Updated on every write |

### 8.6 Behaviour Rules

- R-KV-1: Keys with elapsed TTL MUST NOT be returned. Treat them as non-existent and return `404 KEY_NOT_FOUND`.
- R-KV-2: `version` starts at `1` on creation and increments by exactly `1` on every successful write.
- R-KV-3: PUT without `If-Match` is unconditional and MUST succeed regardless of current version.
- R-KV-4: `If-Match: 0` on an existing key MUST return `409 CONFLICT`.
- R-KV-5: An agent MUST NOT access another agent's private namespace. Returns `403 NAMESPACE_FORBIDDEN`.
- R-KV-6: The `shared` namespace is accessible to all agents within the same tenant only.
- R-KV-7: Values exceeding 100KB of UTF-8 encoded serialized JSON MUST return `413 PAYLOAD_TOO_LARGE`. JSON `null` is a valid value.
- R-KV-8: Namespace name `shared` is reserved and MUST NOT be usable as an agent name.
- R-KV-9: Expired keys MUST be physically purged within 1 hour (background or lazy cleanup is acceptable).

### 8.7 KV Edge Cases

- EC-KV-1: Key expires between read and a subsequent CAS write → CAS returns `404 KEY_NOT_FOUND`. Agent must re-create.
- EC-KV-2: Two agents write to `shared/key` simultaneously without CAS → last writer wins. Expected and documented. Agents requiring safe concurrent writes MUST use CAS.
- EC-KV-3: TTL of 1 second set → GET within 500ms MUST succeed. Clock skew within 500ms MUST NOT cause premature expiry.
- EC-KV-4: Cross-tenant: Agent of Tenant B cannot access any key of Tenant A, including shared keys → `404 NOT_FOUND` (not `403`, existence is not revealed).

---

## 9. Tool: Scheduler

### 9.1 Purpose

Allows agents to schedule their own future continuations. An agent says "fire this callback in 90 minutes" and AgentUtils handles the timing. Supports `once` type only — external cron (GitHub Actions, Railway, etc.) triggers the initial job; agents use the Scheduler to self-schedule subsequent steps.

### 9.2 Endpoints

#### POST /v1/schedules

**Request body:**
```json
{
  "callback_url": "https://hermes.internal/agents/rx0/resume",
  "callback_payload": {
    "workflow_id": "wf_pr123",
    "step": "check_ci_result"
  },
  "fire_at": "2025-01-15T11:30:00Z",
  "dlq_on_failure": true,
  "label": "Check CI result for PR-123"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `callback_url` | string | yes | valid HTTPS URL, max 2048 chars |
| `callback_payload` | object\|null | no | max 100KB |
| `fire_at` | ISO 8601 | yes | must be ≥ 60 seconds in the future, ≤ 30 days in the future |
| `dlq_on_failure` | boolean | no | default `true` |
| `label` | string | no | max 256 chars |

**Response 201:**
```json
{
  "data": {
    "id": "sched_01JXYZ",
    "agent_id": "rx0",
    "callback_url": "https://hermes.internal/agents/rx0/resume",
    "fire_at": "2025-01-15T11:30:00Z",
    "status": "pending",
    "dlq_on_failure": true,
    "label": "Check CI result for PR-123",
    "attempt_count": 0,
    "created_at": "2025-01-15T09:58:00Z"
  }
}
```

#### GET /v1/schedules

List schedules for the calling agent. Query params: `?status=pending|fired|cancelled|failed&cursor=xxx&limit=20`

#### GET /v1/schedules/{id}

Get a single schedule.

#### PATCH /v1/schedules/{id}

Update a pending schedule. Only `fire_at`, `callback_url`, `callback_payload`, and `label` are patchable. Returns `409 SCHEDULE_ALREADY_CANCELLED` if not pending.

#### DELETE /v1/schedules/{id}

Cancel a pending schedule. Returns `204`. Returns `409` if already fired.

### 9.3 Data Model

| Field | Type | Notes |
|---|---|---|
| `id` | string | Prefix `sched_` |
| `agent_id` | string | Creating agent |
| `callback_url` | string | Callback destination |
| `callback_payload` | object\|null | Sent verbatim in callback |
| `fire_at` | ISO 8601 | Scheduled time |
| `status` | enum | `pending`, `fired`, `cancelled`, `failed` |
| `attempt_count` | integer | Callback attempts made |
| `last_attempt_at` | ISO 8601\|null | Last attempt time |
| `dlq_on_failure` | boolean | Push to DLQ after all retries exhausted |
| `label` | string\|null | Human-readable label |
| `created_at` | ISO 8601 | — |
| `fired_at` | ISO 8601\|null | Time of first successful delivery |

### 9.4 Callback Delivery

When AgentUtils fires a schedule:

```
POST {callback_url}
Content-Type: application/json
X-AgentUtils-Event: schedule.fired
X-AgentUtils-Schedule-Id: sched_01JXYZ
X-AgentUtils-Attempt: 1
X-AgentUtils-Timestamp: 2025-01-15T11:30:02Z
X-AgentUtils-Signature: v1=<hex_hmac_sha256>
X-AgentUtils-Delivery-Id: del_01JXYZ

{
  "event": "schedule.fired",
  "schedule_id": "sched_01JXYZ",
  "agent_id": "rx0",
  "fired_at": "2025-01-15T11:30:02Z",
  "attempt": 1,
  "payload": { ... }
}
```

Success = callback returns `2xx` within **30 seconds**.

**Retry policy (fixed, not configurable):** 3 attempts, exponential backoff.
- Attempt 1: at `fire_at`
- Attempt 2: 30 seconds after attempt 1 failure
- Attempt 3: 90 seconds after attempt 2 failure
- After all attempts exhausted: if `dlq_on_failure=true`, create a DLQ item with `status="failed"`, `source="scheduler"`, and `source_id=schedule_id`

### 9.5 Behaviour Rules

- R-SCH-1: `fire_at` MUST be ≥ 60 seconds in the future at creation time.
- R-SCH-2: Callback delivery MUST be attempted within ±30 seconds of `fire_at`.
- R-SCH-3: A cancelled schedule MUST NOT be fired. If a delivery attempt is already in flight when cancellation is received, the delivery counts; the schedule status becomes `fired`.
- R-SCH-4: Status moves to `fired` after the first successful `2xx` response.
- R-SCH-5: If `dlq_on_failure=false` and all retries fail, status moves to `failed` with no DLQ entry.
- R-SCH-6: Tenant quota applies to total active schedules across all agents. Return `429 QUOTA_EXCEEDED` with `details.quota="schedules_active"` when the tenant limit is reached.
- R-SCH-7: `callback_payload` is sent verbatim. AgentUtils adds metadata via HTTP headers only, not by mutating the payload.
- R-SCH-8: AgentUtils signs every callback using the headers in Security Requirements. The receiving agent runtime is responsible for verifying the signature before acting.

### 9.6 Scheduler Edge Cases

- EC-SCH-1: Agent creates schedule and crashes. AgentUtils MUST still fire the callback — the creating agent's health is irrelevant.
- EC-SCH-2: Agent creates schedule and immediately cancels. If callback not yet sent, cancel suppresses it. If already sent, status is `fired` and DELETE returns `409`.
- EC-SCH-3: Tenant suspended when `fire_at` elapses → callback not fired, job paused. On reactivation, missed `fire_at` is gone. No DLQ entry created — suspension is not a failure.

---

## 10. Tool: Dead Letter Queue

### 10.1 Purpose

A durable failure registry for agent side-effects. If an agent, Scheduler delivery, HitL resolution callback, webhook handler, or other side-effect fails, AgentUtils stores enough context for a later agent run or approved worker to inspect, claim, retry in its own code, and resolve the failure.

**DLQ is independent of Scheduler.** DLQ correctness MUST NOT depend on Scheduler availability. Scheduler may create DLQ items after callback delivery failures, and future versions may use Scheduler to notify agents that an item is ready to inspect, but DLQ itself is not a scheduler, worker queue, or execution engine.

**Execution boundary:** AgentUtils stores failed work items, provides atomic claim/release/fail/resolve semantics, and preserves context. AgentUtils does not execute the original operation, run custom retry code, guarantee automatic recovery, or re-deliver arbitrary callbacks from DLQ in MVP.

### 10.2 Endpoints

#### POST /v1/dlq

Create a failed work item.

**Request body:**
```json
{
  "workflow_id": "wf_pr123",
  "operation": "github.merge_pr",
  "source": "webhook_handler",
  "source_id": "webhook_github_pr_123",
  "payload": {
    "pr_number": 123,
    "action": "merge"
  },
  "error": {
    "type": "HTTP_503",
    "message": "GitHub API returned 503",
    "code": "UPSTREAM_ERROR"
  },
  "max_attempts": 5,
  "label": "GitHub PR merge handler failure"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `workflow_id` | string | no | Correlates to a multi-step workflow, max 256 chars |
| `operation` | string | yes | Original side-effect operation, dot-namespaced, max 128 chars |
| `source` | string | yes | Origin identifier, max 128 chars (e.g., `"scheduler"`, `"checkpoint"`, `"webhook_handler"`, `"agent"`) |
| `source_id` | string | no | ID of originating resource, max 256 chars |
| `payload` | object\|null | no | Original job data, max 1MB |
| `error.type` | string | no | Machine-readable class, e.g. `HTTP_503`, `VALIDATION_ERROR` |
| `error.message` | string | yes | max 1024 chars |
| `error.code` | string | no | Machine-readable upstream/application code |
| `max_attempts` | integer | no | 1–20, default 5 |
| `label` | string | no | max 256 chars |

**Response 201:**
```json
{
  "data": {
    "id": "dlq_01JXYZ",
    "agent_id": "rx0",
    "workflow_id": "wf_pr123",
    "operation": "github.merge_pr",
    "source": "webhook_handler",
    "source_id": "webhook_github_pr_123",
    "status": "failed",
    "attempt_count": 0,
    "max_attempts": 5,
    "failed_at": "2025-01-15T09:58:00Z",
    "label": "GitHub PR merge handler failure",
    "created_at": "2025-01-15T09:58:00Z"
  }
}
```

#### GET /v1/dlq

List DLQ items for the calling agent. Query params: `?status=failed|claimed|resolved|archived&workflow_id=wf_pr123&operation=github.merge_pr&source=scheduler&cursor=xxx&limit=20`.

#### GET /v1/dlq/{id}

Get a single DLQ item. Includes full `payload`, `error`, `last_error`, and `result` fields.

#### POST /v1/dlq/{id}/claim

Atomically claim the item for retry or inspection. Sets status to `claimed` and locks it for the requested duration.

**Request body:**
```json
{
  "lock_seconds": 300
}
```

Rules:
- If item is `failed`, claim succeeds.
- If item is `claimed` and `locked_until` is still in the future, return `409 DLQ_ITEM_LOCKED` with `locked_until` in details.
- If item is `claimed` but `locked_until` has passed, reclaim succeeds.
- Claim operation MUST be atomic.
- Returns `409 DLQ_ITEM_ALREADY_RESOLVED` if item is `resolved` or `archived`.

**Response 200:**
```json
{
  "data": {
    "id": "dlq_01JXYZ",
    "status": "claimed",
    "attempt_count": 1,
    "last_attempted_at": "2025-01-15T10:00:00Z",
    "locked_until": "2025-01-15T10:05:00Z"
  }
}
```

#### POST /v1/dlq/{id}/release

Release a claimed item without marking it resolved. Used when the claiming agent inspected the item but cannot handle it.

**Request body:**
```json
{
  "reason": "Missing GitHub token in this runtime"
}
```

Sets status back to `failed`, clears `locked_until`, and records `last_error` with the release reason.

#### POST /v1/dlq/{id}/fail

Record that the retry attempt failed again.

**Request body:**
```json
{
  "error": {
    "type": "HTTP_429",
    "message": "GitHub rate limited",
    "code": "RATE_LIMITED"
  },
  "next_retry_after": "2025-01-15T11:00:00Z"
}
```

Rules:
- `next_retry_after` is metadata only in MVP. It does not cause AgentUtils to automatically retry.
- If `attempt_count >= max_attempts`, the item remains `failed` but should be surfaced as exhausted via `exhausted=true` in responses.
- Agent or human may still claim an exhausted item manually.

#### POST /v1/dlq/{id}/resolve

Mark item as resolved after the agent has handled it.

**Request body:**
```json
{
  "resolution": "PR merged successfully after retry",
  "result": {
    "url": "https://github.com/org/repo/pull/123"
  }
}
```

Sets `status=resolved`, `resolved_at`, `resolved_by`, and stores `result`. Owning agent may resolve directly without claiming first if the retry happened outside AgentUtils.

#### DELETE /v1/dlq/{id}

Archive the item. This is a soft-delete for auditability: item is retained with `archived_at` timestamp for the retention window.

### 10.3 Data Model

| Field | Type | Notes |
|---|---|---|
| `id` | string | Prefix `dlq_` |
| `agent_id` | string | Owning agent |
| `workflow_id` | string\|null | Workflow correlation ID |
| `operation` | string | Original side-effect operation |
| `source` | string | Origin of the failure |
| `source_id` | string\|null | Originating resource ID |
| `payload` | object\|null | Original job data |
| `error.type` | string\|null | Initial error type |
| `error.message` | string | Initial error description |
| `error.code` | string\|null | Initial machine-readable code |
| `last_error` | object\|null | Most recent release/fail details |
| `failed_at` | ISO 8601 | Last time status became `failed` |
| `last_attempted_at` | ISO 8601\|null | Most recent claim/retry attempt |
| `next_retry_after` | ISO 8601\|null | Metadata only; no automatic retry in MVP |
| `status` | enum | `failed`, `claimed`, `resolved`, `archived` |
| `attempt_count` | integer | Claim/retry attempts from DLQ |
| `max_attempts` | integer | Default 5 |
| `exhausted` | boolean | true when `attempt_count >= max_attempts` and not resolved |
| `locked_by` | string\|null | Agent/process that claimed item |
| `locked_until` | ISO 8601\|null | Set when status is `claimed` |
| `label` | string\|null | — |
| `created_at` | ISO 8601 | — |
| `resolved_at` | ISO 8601\|null | — |
| `resolved_by` | string\|null | — |
| `archived_at` | ISO 8601\|null | — |
| `result` | object\|null | Result metadata supplied on resolve |

### 10.4 Status Transitions

```text
failed  -> claimed   (agent calls /claim — lock acquired)
claimed -> failed    (agent calls /release or /fail)
claimed -> failed    (lock expires)
claimed -> resolved  (agent calls /resolve)
failed  -> resolved  (agent calls /resolve directly)
failed  -> archived  (agent calls DELETE)
resolved -> archived (optional cleanup/archive)
```

`exhausted=true` is a derived flag, not a separate status. Exhausted items remain claimable manually.

### 10.5 Behaviour Rules

- R-DLQ-1: DLQ writes are synchronously committed to durable storage. If durable storage is unavailable, return `500 INTERNAL_ERROR` and emit an internal alert. Do not acknowledge a DLQ item that was not durably stored.
- R-DLQ-2: A locked item MUST reject concurrent claim attempts with `409 DLQ_ITEM_LOCKED`.
- R-DLQ-3: If the claim lock expires without `/resolve`, `/release`, or `/fail`, the item returns to `failed` automatically.
- R-DLQ-4: An agent can only read and manage its own DLQ items in MVP. Accessing another agent's item within the same tenant returns `403 FORBIDDEN`; cross-tenant access returns `404 NOT_FOUND`.
- R-DLQ-5: DLQ items are retained for **30 days** regardless of status, then purged.
- R-DLQ-6: Items pushed automatically by Scheduler MUST include `source="scheduler"` and `source_id=<schedule_id>`. The payload MUST include the original `callback_payload` from the schedule.
- R-DLQ-7: Items pushed automatically by HitL callback delivery failure MUST include `source="checkpoint"` and `source_id=<checkpoint_id>`. The payload MUST include the decision, resolver, and original `callback_payload`.
- R-DLQ-8: `next_retry_after` does not create a scheduled job in MVP. Scheduler integration is optional and post-MVP.

### 10.6 DLQ Edge Cases

- EC-DLQ-1: Scheduler exhausts callback retries → DLQ item created → agent later calls /claim → agent retries original work in its own code → agent calls /resolve. Agent MUST call /resolve; AgentUtils does not auto-resolve.
- EC-DLQ-2: Two processes call /claim simultaneously on the same item → first acquires lock → second gets `409 DLQ_ITEM_LOCKED`. Only one process handles the item.
- EC-DLQ-3: Lock expiry at T, agent calls /claim at T+1ms → MUST succeed. Lock is checked at request time.
- EC-DLQ-4: Agent calls /resolve on an item it has not claimed → succeeds. The /claim step is optional if the agent resolved the failure externally.
- EC-DLQ-5: Agent calls /fail with `next_retry_after` → item stores metadata and returns to `failed`; no automatic retry happens.

---

## 11. Tool: Audit Log

### 11.1 Purpose

Append-only, immutable record of agent actions within a tenant. The Audit Log is the black box recorder for multi-agent workflows. All agents within the same tenant may read the full audit log — transparency is the design intent, and all agents belong to the same owner. Reads are scoped to the calling tenant; no cross-tenant log access is possible.

### 11.2 Endpoints

#### POST /v1/audit

Write an audit entry.

**Request body:**
```json
{
  "action": "deployment.initiated",
  "resource_type": "deployment",
  "resource_id": "deploy_prod_v213",
  "payload": {
    "version": "v2.1.3",
    "environment": "production",
    "files_changed": 12
  },
  "metadata": {
    "workflow_id": "wf_pr123",
    "session_id": "sess_abc"
  }
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `action` | string | yes | Dot-namespaced, max 128 chars (e.g., `"deployment.initiated"`) |
| `resource_type` | string | no | max 64 chars |
| `resource_id` | string | no | max 256 chars |
| `payload` | object\|null | no | max 10KB |
| `metadata.workflow_id` | string | no | Links entry to a workflow |
| `metadata.session_id` | string | no | Links entry to a session |

**Response 201:**
```json
{
  "data": {
    "id": "log_01JXYZ",
    "agent_id": "rx0",
    "action": "deployment.initiated",
    "timestamp": "2025-01-15T11:29:58Z"
  }
}
```

Write is synchronous from the caller's perspective — `201` means durably queued. Flush to storage may be async but entries MUST NOT be lost.

#### GET /v1/audit

Query the audit log. Returns entries for the calling tenant only.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `agent_id` | string | Filter by agent |
| `from` | ISO 8601 | Start of time range (inclusive) |
| `to` | ISO 8601 | End of time range (exclusive) |
| `workflow_id` | string | Filter by `metadata.workflow_id` |
| `cursor` | string | Pagination cursor |
| `limit` | integer | 1–100, default 20 |

Results are returned in descending timestamp order (newest first) by default. Add `?sort=asc` for ascending.

#### GET /v1/audit/{id}

Get a single audit entry by ID.

### 11.3 Data Model

| Field | Type | Notes |
|---|---|---|
| `id` | string | Prefix `log_`, immutable |
| `agent_id` | string | Writing agent |
| `action` | string | Dot-namespaced action name |
| `resource_type` | string\|null | — |
| `resource_id` | string\|null | — |
| `payload` | object\|null | — |
| `metadata` | object\|null | `workflow_id`, `session_id`, extensible |
| `timestamp` | ISO 8601 | Server-assigned at receipt |

### 11.4 Behaviour Rules

- R-AL-1: Audit log entries are **immutable**. No DELETE or PATCH endpoint exists.
- R-AL-2: `timestamp` is always server-assigned. Clients cannot supply timestamps.
- R-AL-3: Audit writes MUST NOT block the calling agent. Return `201` as soon as durably queued.
- R-AL-4: Once `201` is returned, no entry MUST be lost. If durable enqueue/write is unavailable, return `500 INTERNAL_ERROR` rather than acknowledging.
- R-AL-5: Any authenticated agent within the same tenant may read all audit entries for that tenant. No per-agent read scoping.
- R-AL-6: Reads are implicitly scoped to the calling tenant. Entries from other tenants are never returned, even for identical `workflow_id` or `resource_id` values.
- R-AL-7: Entries are retained per the tenant's plan (7 days Free, 30 days Pro) then purged.
- R-AL-8: Payload exceeding 10KB MUST return `413 PAYLOAD_TOO_LARGE`.

### 11.5 Audit Log Edge Cases

- EC-AL-1: Audit writes use the same per-tenant rate limit unless a separate audit-ingest quota is explicitly implemented. Over-limit writes return `429 RATE_LIMITED`.
- EC-AL-2: Two agents write identical payloads simultaneously → both succeed with different IDs and timestamps. No deduplication.
- EC-AL-3: Tenant A and Tenant B both use `workflow_id=wf_pr123` → `GET /audit?workflow_id=wf_pr123` returns only entries from the calling tenant.

---

## 12. Tool: HitL Checkpoint

### 12.1 Purpose

Async pause-and-resume mechanism. An agent creates a checkpoint when it needs human approval before proceeding with a risky, destructive, paid, or externally-visible action. The agent's session ends. The workflow resumes only after a human approves or rejects via the API.

**Architecturally different from in-session clarification:** clarify is synchronous and blocks the session. A HitL Checkpoint is asynchronous — the session can end, and the workflow resumes in a future session.

### 12.2 Endpoints

#### POST /v1/checkpoints

**Request body:**
```json
{
  "title": "Approve production deployment v2.1.3",
  "description": "RX-0 wants to deploy v2.1.3 to prod-sg. 12 files changed including payments.ts.",
  "context": {
    "diff_url": "https://github.com/org/repo/pull/123/files",
    "risk_level": "high",
    "reversible": true
  },
  "expires_in_seconds": 86400,
  "timeout_action": "auto_reject",
  "callback_url": "https://hermes.internal/agents/rx0/resume",
  "callback_payload": {
    "workflow_id": "wf_pr123",
    "step": "deploy"
  }
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | yes | max 256 chars |
| `description` | string | no | max 4096 chars |
| `context` | object\|null | no | max 50KB, arbitrary structured data for human review |
| `expires_in_seconds` | integer | no | 300–604800 (5 min to 7 days), default 86400 |
| `timeout_action` | enum | no | `"auto_reject"` or `"dlq"` — default `"auto_reject"` |
| `callback_url` | string | yes | HTTPS URL that receives resolution POST |
| `callback_payload` | object\|null | no | max 100KB, echoed in resolution callback |

**Response 201:**
```json
{
  "data": {
    "id": "hitl_01JXYZ",
    "agent_id": "rx0",
    "title": "Approve production deployment v2.1.3",
    "status": "pending",
    "expires_at": "2025-01-16T11:30:00Z",
    "timeout_action": "auto_reject",
    "created_at": "2025-01-15T11:30:00Z"
  }
}
```

#### GET /v1/checkpoints

List checkpoints. Any authenticated agent within the tenant can list all checkpoints. Query params: `?status=pending|approved|rejected|expired|cancelled&agent_id=rx0&cursor=xxx`

#### GET /v1/checkpoints/{id}

Get checkpoint details including full `context`. Used by agents polling for resolution.

**Response includes `resolution` block when resolved:**
```json
{
  "data": {
    "id": "hitl_01JXYZ",
    "status": "approved",
    "resolution": {
      "decision": "approved",
      "by": "gibson",
      "note": "LGTM, deploy during off-peak",
      "resolved_at": "2025-01-15T12:15:00Z"
    }
  }
}
```

#### POST /v1/checkpoints/{id}/approve

**Request body:**
```json
{
  "by": "gibson",
  "note": "LGTM"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `by` | string | yes | Identifier of approver, max 128 chars |
| `note` | string | no | max 1024 chars |

Requires a tenant admin key or scoped approval-proxy key. Agent keys MUST NOT approve checkpoints.

Returns `200`. Status moves to `approved`. Callback is triggered.
Returns `409 CHECKPOINT_ALREADY_RESOLVED` if not pending.

#### POST /v1/checkpoints/{id}/reject

Requires a tenant admin key or scoped approval-proxy key. Agent keys MUST NOT reject checkpoints. Same body as approve. Status moves to `rejected`. Callback triggered.

#### DELETE /v1/checkpoints/{id}

Agent cancels its own pending checkpoint. Status moves to `cancelled`. No callback. Returns `409` if already resolved.

### 12.3 Resolution Callback

On approve, reject, or timeout:

```
POST {callback_url}
Content-Type: application/json
X-AgentUtils-Event: checkpoint.resolved
X-AgentUtils-Checkpoint-Id: hitl_01JXYZ
X-AgentUtils-Timestamp: 2025-01-15T12:15:00Z
X-AgentUtils-Signature: v1=<hex_hmac_sha256>
X-AgentUtils-Delivery-Id: del_01JXYZ

{
  "event": "checkpoint.resolved",
  "checkpoint_id": "hitl_01JXYZ",
  "agent_id": "rx0",
  "decision": "approved",
  "resolved_by": "gibson",
  "note": "LGTM",
  "resolved_at": "2025-01-15T12:15:00Z",
  "original_payload": { ... }
}
```

Callback retry policy: 3 attempts, exponential backoff (same as Scheduler). If all retries fail, a DLQ entry is created with `source="checkpoint"` and `source_id=checkpoint_id`. The checkpoint status remains `approved`/`rejected` — the DLQ entry handles delivery failure independently.

### 12.4 Timeout Behaviour

When `expires_at` elapses:
- `timeout_action = "auto_reject"` → status `rejected`, decision `"expired"`, callback fires with note `"Auto-rejected due to timeout"`
- `timeout_action = "dlq"` → status `expired`, DLQ entry created with full checkpoint context. No callback fired.

### 12.5 Data Model

| Field | Type | Notes |
|---|---|---|
| `id` | string | Prefix `hitl_` |
| `agent_id` | string | Creating agent |
| `title` | string | — |
| `description` | string\|null | — |
| `context` | object\|null | Structured context for human review |
| `status` | enum | `pending`, `approved`, `rejected`, `expired`, `cancelled` |
| `expires_at` | ISO 8601 | Timeout time |
| `timeout_action` | enum | `auto_reject`, `dlq` |
| `callback_url` | string | Agent's resume endpoint |
| `callback_payload` | object\|null | Echoed in resolution callback |
| `resolution.decision` | enum\|null | `approved`, `rejected`, `expired` |
| `resolution.by` | string\|null | Resolver identifier |
| `resolution.note` | string\|null | — |
| `resolution.resolved_at` | ISO 8601\|null | — |
| `created_at` | ISO 8601 | — |

### 12.6 Behaviour Rules

- R-HITL-1: A tenant MUST NOT have more than the plan quota of pending checkpoints simultaneously. Returns `429 QUOTA_EXCEEDED` with `details.quota="checkpoints_pending"`.
- R-HITL-2: Callback delivery MUST be attempted within 30 seconds of a resolution event.
- R-HITL-3: Approving or rejecting an already-resolved checkpoint MUST return `409 CHECKPOINT_ALREADY_RESOLVED`.
- R-HITL-4: Only the creating agent may cancel (DELETE) its own checkpoint. Other agents return `403 FORBIDDEN`.
- R-HITL-5: `context` exceeding 50KB MUST return `413 PAYLOAD_TOO_LARGE`. Store large context as a file (e.g., in S3) and pass the URL in context instead.
- R-HITL-6: Only tenant admin keys or scoped approval-proxy keys within the same tenant may approve or reject a checkpoint. Cross-tenant approve attempts MUST return `404 NOT_FOUND` — do not reveal the checkpoint's existence.
- R-HITL-7: Agent keys may create, read, list, poll, and cancel their own checkpoints, but MUST NOT approve or reject checkpoints. Telegram/WhatsApp/Hermes Chat bots may approve only when using scoped approval-proxy credentials.
- R-HITL-8: `auto_approve` is not a valid `timeout_action`. Only `auto_reject` and `dlq` are accepted. Requests with `timeout_action="auto_approve"` MUST return `400 VALIDATION_ERROR`.

### 12.7 HitL Edge Cases

- EC-HITL-1: Agent creates checkpoint → agent crashes → checkpoint remains `pending` → human approves → callback fires → callback returns `5xx` → retry → all retries fail → DLQ entry created. When agent recovers, it finds the DLQ entry, reads decision from payload, claims it if needed, processes the recovery path, and calls /resolve.
- EC-HITL-2: `timeout_action="dlq"` → expires → DLQ entry created → agent treats expiry as implicit rejection.
- EC-HITL-3: Two agents create checkpoints simultaneously → independent. Human sees two items in GET /checkpoints list. No coupling.
- EC-HITL-4: Agent polling is supported via `GET /checkpoints/{id}` with callback-first design. Polling must have a documented separate quota or long-poll behavior; it must not silently bypass tenant rate limits.
- EC-HITL-5: Context references a file URL (e.g., S3 pre-signed URL) that expires before human reviews → agent's responsibility to set file TTL longer than checkpoint `expires_in_seconds`.

---

## 13. Multi-Agent and Multi-Tenant Edge Cases

### Within-Tenant

**ME-1: Scheduler → DLQ cascade**
RX-0 schedules a callback for 90 minutes. Callback fails 3 times. DLQ entry created. RX-0 calls /claim, retries the original work in its own code, then calls /resolve. Full chain is traceable via `source_id` in DLQ pointing to the schedule ID.

**ME-2: HitL + crashed agent**
RX-0 creates HitL checkpoint then crashes. Human approves via Telegram bot. Callback fires to crashed endpoint. All retries fail. DLQ entry created with `source="checkpoint"`. When RX-0 recovers, it finds the DLQ entry containing the approval decision, claims it if needed, processes the recovery path, and calls /resolve.

**ME-3: KV CAS concurrency**
RX-0 and QA Agent both read `shared/build-status` (version=3). Both try PUT with `If-Match: 3`. First writer succeeds (version→4). Second gets `409 VERSION_MISMATCH` with `current_version=4`. Second writer must re-read and retry.

**ME-4: Audit log as workflow debugger**
A 3-hour multi-agent workflow fails. Gibson queries GET /audit filtered by agent_id and time range. All entries from RX-0, QA Agent, Claude Code — all visible because they share a tenant. Timeline reconstructed.

**ME-5: DLQ concurrent retry**
Two retry workers for the owning agent both call /claim on the same DLQ item simultaneously. First acquires the 5-minute lock. Second gets `409 DLQ_ITEM_LOCKED`. Only one handles the item. DLQ remains per-agent in MVP; tenant-wide/shared DLQ is deferred.

### Cross-Tenant

**ME-MT-1: Same agent name across tenants**
Tenant A has agent `rx0`. Tenant B has agent `rx0`. They coexist independently. Their audit logs, KV keys, and schedules never mix.

**ME-MT-2: Cross-tenant resource ID guessing**
Tenant B guesses `hitl_01JXYZ` belongs to Tenant A and calls GET /checkpoints/hitl_01JXYZ. Response: `404 NOT_FOUND`. Not `403`. The existence of the resource is not revealed. Any response other than `404` is a data leak.

**ME-MT-3: Suspended tenant mid-workflow**
Tenant A has a scheduled callback due at hour 2.5 of a 3-hour workflow. At hour 2, the tenant is suspended. Callback not fired (jobs paused). Not pushed to DLQ — suspension is not a failure. When reactivated, the missed `fire_at` is gone.

**ME-MT-4: Tenant deletion with active checkpoints**
Tenant A has pending HitL checkpoints. DELETE /v1/tenants is called. All checkpoints immediately move to `cancelled`. No callbacks fired. Data purged within 24 hours.

**ME-MT-5: Quota race**
Tenant at 4/5 checkpoint limit. Two agents create checkpoints simultaneously. Exactly one succeeds (201). Other gets `429 QUOTA_EXCEEDED`. Quota enforcement MUST be atomic.

**ME-MT-6: Agent identity spoofing**
Agent presents `X-Agent-Id: rx0` with an API key registered to a different agent. Response: `401 INVALID_CREDENTIALS`. A key registered for `openclaw` MUST NOT grant access as `rx0` or in any other tenant.

---

## 14. Definition of Done

Format: **ID | Given | When | Then | Pass if**

All items MUST pass before the service handles real users. MT-001 through MT-010 are the highest-priority group — failures there mean data leaks between tenants.

### 14.1 KV Store

| ID | Given | When | Then | Pass if |
|---|---|---|---|---|
| KV-001 | Agent authenticated | PUT `/{agent_id}/mykey` with value `"hello"` | Stored | 200; GET returns `"hello"` |
| KV-002 | Key does not exist | GET `/{agent_id}/missingkey` | Not found | 404, code `KEY_NOT_FOUND` |
| KV-003 | Key has TTL 2 seconds | Wait 3 seconds, GET | Expired | 404, code `KEY_NOT_FOUND` |
| KV-004 | Key exists version=3 | PUT with `If-Match: 3` | Succeeds | 200; response version=4 |
| KV-005 | Key exists version=3 | PUT with `If-Match: 2` | Rejected | 409, code `VERSION_MISMATCH`, `current_version=3` |
| KV-006 | Key does not exist | PUT with `If-Match: 0` | Created | 200; GET returns value |
| KV-007 | Authenticated as `rx0` | GET `/qa-agent/key` | Forbidden | 403, code `NAMESPACE_FORBIDDEN` |
| KV-008 | Two agents, no CAS | Both PUT `shared/key` simultaneously | Both succeed | Both 200; GET returns one value |
| KV-009 | Two agents with CAS | Both read version=1, both PUT `If-Match: 1` | One succeeds | One 200; one 409 `VERSION_MISMATCH` |
| KV-010 | Value is 101KB | PUT | Rejected | 413 |
| KV-011 | Key exists | DELETE | Removed | 204; GET returns 404 |
| KV-012 | Unauthenticated | Any endpoint | Rejected | 401 `MISSING_AUTH_HEADERS` |

### 14.2 Scheduler

| ID | Given | When | Then | Pass if |
|---|---|---|---|---|
| SCH-001 | Agent authenticated | POST schedule `fire_at`=now+120s | Created | 201, status=pending |
| SCH-002 | Schedule pending | Wait for `fire_at` | Callback fired | POST received within ±30s of `fire_at` |
| SCH-003 | Callback returns 500 | First attempt fails | Retry at 30s | Second attempt made ~30s later |
| SCH-004 | All 3 retries fail, `dlq_on_failure=true` | Retries exhausted | DLQ entry | DLQ item exists, `source="scheduler"`, `source_id=schedule_id` |
| SCH-005 | `dlq_on_failure=false`, all retries fail | Retries exhausted | No DLQ | Status=failed; GET /dlq returns nothing |
| SCH-006 | Schedule pending | DELETE before `fire_at` | Cancelled | 204; callback NOT received after `fire_at` |
| SCH-007 | Schedule already fired | DELETE | Rejected | 409 |
| SCH-008 | `fire_at`=now+30s (below 60s minimum) | POST | Rejected | 400, validation error on `fire_at` |
| SCH-009 | Tenant at schedule quota | POST new schedule | Rejected | 429, code `QUOTA_EXCEEDED`, `details.quota="schedules_active"` |
| SCH-010 | Schedule pending | PATCH `callback_url` | Updated | Subsequent fire uses new URL |
| SCH-011 | `fire_at`=31 days future | POST | Rejected | 400, validation error |

### 14.3 Dead Letter Queue

| ID | Given | When | Then | Pass if |
|---|---|---|---|---|
| DLQ-001 | Agent authenticated | POST DLQ item | Created | 201, status=`failed`, `failed_at` set |
| DLQ-002 | Item failed | POST /claim | Locked | 200, status=`claimed`, `locked_until` and `last_attempted_at` set |
| DLQ-003 | Item claimed with active lock | POST /claim again | Rejected | 409, code `DLQ_ITEM_LOCKED`, `locked_until` in details |
| DLQ-004 | Lock expires | GET item | Lock cleared | 200, status=`failed`, `locked_until=null` |
| DLQ-005 | Agent claims, retries in own code, calls /resolve | Full cycle | Resolved | 200, status=`resolved`, `result` stored |
| DLQ-006 | Agent claims, retry fails | POST /fail | Failed again | status=`failed`, `last_error` and `next_retry_after` stored; no schedule created |
| DLQ-007 | Item resolved | POST /claim | Rejected | 409, code `DLQ_ITEM_ALREADY_RESOLVED` |
| DLQ-008 | Item exists | DELETE | Archived | 204; GET returns item with status=`archived` during retention window |
| DLQ-009 | Scheduler pushes after callback failure | GET /dlq | Visible | `source="scheduler"`, `source_id=schedule_id`, status=`failed` |
| DLQ-010 | Agent B gets Agent A's item | GET /dlq/{id} | Forbidden | 403 within same tenant; 404 cross-tenant |
| DLQ-011 | 100 items written simultaneously | POST × 100 | All created | All 201; all retrievable with unique IDs |
| DLQ-012 | Scheduler is not implemented/enabled | Use DLQ endpoints | DLQ still works | POST/list/claim/fail/release/resolve pass without Scheduler service |

### 14.4 Audit Log

| ID | Given | When | Then | Pass if |
|---|---|---|---|---|
| AL-001 | Agent authenticated | POST audit entry | Created | 201, id returned |
| AL-002 | Entry written | GET /audit/{id} | Retrievable | 200, all fields match |
| AL-003 | Entries from multiple agents in tenant | GET /audit (no filters) | All visible | Entries from all agents returned |
| AL-004 | Entry written at T | GET /audit?from=T-1s&to=T+1s | In results | Entry present |
| AL-005 | Entry written | PATCH or DELETE /audit/{id} | Rejected | 404 or 405 |
| AL-006 | Agent writes entry | Server receives | Timestamp server-set | `timestamp` within 2s of receipt; not client-supplied |
| AL-007 | Audit writes exceed tenant rate limit | All writes | Rate limited predictably | Accepted writes return 201; excess writes return 429 with rate-limit headers |
| AL-008 | Payload is 11KB | POST | Rejected | 413 |

### 14.5 HitL Checkpoint

| ID | Given | When | Then | Pass if |
|---|---|---|---|---|
| HITL-001 | Agent authenticated | POST checkpoint | Created | 201, status=pending |
| HITL-002 | Checkpoint pending | GET /checkpoints/{id} | Pending status | 200, status=pending |
| HITL-003 | Checkpoint pending, approval-proxy/admin auth | POST /approve `by=gibson` | Approved | 200, status=approved, signed callback fired |
| HITL-004 | Callback receives POST on approval | Payload checked | Matches spec | `event=checkpoint.resolved`, `decision=approved`, `original_payload` echoed |
| HITL-005 | Checkpoint pending | POST /reject | Rejected | 200, status=rejected, callback fired |
| HITL-006 | Checkpoint approved | POST /approve again | Conflict | 409, code `CHECKPOINT_ALREADY_RESOLVED` |
| HITL-007 | `expires_in_seconds=300`, `timeout_action=auto_reject` | 300+ seconds elapse | Auto-rejected | status=rejected, decision=expired, callback fires |
| HITL-008 | `timeout_action=dlq` | Checkpoint expires | DLQ entry | DLQ item exists with source=checkpoint, checkpoint context in payload |
| HITL-009 | Tenant at checkpoint quota | POST another | Rejected | 429, code `QUOTA_EXCEEDED`, `details.quota="checkpoints_pending"` |
| HITL-010 | Callback returns 500 on approval, all retries fail | DLQ created | checkpoint still approved | DLQ source=checkpoint; status=approved unchanged |
| HITL-011 | Checkpoint pending | DELETE (agent cancels) | Cancelled | 204, status=cancelled, no callback |
| HITL-012 | context is 51KB | POST | Rejected | 413 |
| HITL-013 | Agent B cancels Agent A's checkpoint | DELETE | Forbidden | 403 |
| HITL-014 | `timeout_action=auto_approve` | POST | Rejected | 400, validation error |

### 14.6 Tenant Isolation (all must pass before any real users)

| ID | Given | When | Then | Pass if |
|---|---|---|---|---|
| MT-001 | Tenants A and B both have `shared/cursor` | Tenant B reads `shared/cursor` | Returns B's value | 200; value matches B's, not A's |
| MT-002 | Tenant A has `sched_01JXYZ` | Tenant B calls GET /schedules/sched_01JXYZ | Not found | 404 — NOT 403 |
| MT-003 | Tenant A has audit entries | Tenant B calls GET /audit | Empty | 200, `data: []` |
| MT-004 | Tenant A creates HitL checkpoint | Tenant B calls POST /checkpoints/{id}/approve | Not found | 404 |
| MT-005 | Tenant A DLQ item exists | Tenant B calls GET /dlq/{item_id} | Not found | 404 — NOT 403 |
| MT-006 | Tenant suspended | Any tool API call | Suspended | 402, code `TENANT_SUSPENDED` |
| MT-007 | Admin key used for tool call | Any tool endpoint | Rejected | 403, code `ADMIN_KEY_REQUIRED` |
| MT-008 | Tenant B key with Tenant A's X-Agent-Id | Any endpoint | Rejected | 401, code `INVALID_CREDENTIALS` |
| MT-009 | Tenant deleted | Any API call | Gone | 410, code `TENANT_DELETED` |
| MT-010 | Two tenants, both have agent named `rx0` | Both make tool calls simultaneously | Both succeed | Both 200; no data mixing |

### 14.7 Cross-Tool

| ID | Scenario | Pass criteria |
|---|---|---|
| CROSS-001 | Scheduler → DLQ cascade | DLQ item has `source="scheduler"`, `source_id=schedule_id`; audit entries from both tools visible |
| CROSS-002 | HitL + crashed agent (ME-2) | DLQ entry created on callback failure; decision embedded in DLQ payload; agent recovers, claims/handles item, and calls /resolve |
| CROSS-003 | KV CAS under concurrency | Exactly one write succeeds; other gets 409; GET returns winning value with incremented version |
| CROSS-004 | API key spoofing | 401 returned; no data accessed |
| CROSS-007 | Signed callback verification | Receiver can verify Scheduler and HitL callbacks using timestamp + body HMAC; spoofed/expired signatures rejected |
| CROSS-008 | Callback SSRF protection | Private, loopback, metadata, redirect, and non-HTTPS callback URLs are rejected before delivery |
| CROSS-005 | Service restart | All KV values, schedules, DLQ items, audit entries, and checkpoints survive restart intact |
| CROSS-006 | Concurrent DLQ writes (50 simultaneous) | All 50 return 201; all 50 retrievable with unique IDs |

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Tenant** | A registered user of AgentUtils as a cloud service. All agents, resources, and data belong to a tenant. |
| **Tenant Admin Key** | API key (prefix `agutil_adm_`) for tenant management and agent registration. |
| **Agent Key** | API key (prefix `agutil_agt_`) for tool API calls as a specific agent. |
| **Tenant Isolation** | The guarantee that no data belonging to Tenant A is accessible to Tenant B under any conditions. |
| **Agent** | An autonomous AI process running in a specific runtime (Hermes, Claude Code, Codex, OpenClaw, etc.) |
| **Agent Runtime** | The execution environment for an agent |
| **CAS** | Compare-And-Swap — atomic conditional write using a version number. Prevents lost updates under concurrency. |
| **Callback** | An HTTP POST made by AgentUtils to an agent's endpoint (on schedule fire, checkpoint resolution, etc.) |
| **DLQ** | Dead Letter Queue — durable failure registry for failed agent side-effects; stores failures for later inspection and agent-executed recovery |
| **HitL** | Human-in-the-Loop — pausing agent execution pending human approval |
| **HitL Checkpoint** | A specific pending approval request, created by an agent |
| **KV Store** | Key-value store for deterministic, structured agent state |
| **Namespace** | First path component of a KV key — scopes the key to an agent or to `shared` (within-tenant) |
| **Quota** | Per-tenant resource limit enforced by AgentUtils to prevent one tenant impacting others |
| **Scheduler** | Tool for agents to schedule their own future single-shot callbacks |
| **Session** | A single execution context for an agent |
| **TTL** | Time-To-Live — how long a resource persists before expiring |
| **Workflow** | A multi-step agent task spanning multiple sessions and/or multiple agents |
