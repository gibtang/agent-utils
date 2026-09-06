# AgentUtils State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver exact, private, versioned JSON State that an Agent can selectively share with named Agents in the same Account.

**Architecture:** A State Record has one owning Agent, a human-readable key, one JSON value, byte size, monotonically increasing version, optional expiry, and explicit read or read-write grants. All mutations run in Mongo transactions with atomic storage accounting. Deleted records are inaccessible immediately and recoverable from owner Trash for seven days; expired records are terminal.

**Tech Stack:** TypeScript, Zod, Mongoose transactions and conditional updates, shared Agent operation registry, MCP, Next.js `/v1`, Vitest.

---

## Task 1: Define State schemas and persistence

**Files:**

- Create: `models/StateRecord.ts`
- Create: `lib/state/schemas.ts`
- Create: `lib/state/size.ts`
- Test: `__tests__/state/models.test.ts`
- Test: `__tests__/state/size.test.ts`

- [ ] Write tests for keys matching `^[a-z0-9][a-z0-9._-]{0,127}$`, all valid JSON types, invalid non-JSON values, optional expiry, owner identity, grants, status, version, and unique `{ accountId, key }`. Account-wide key uniqueness keeps `state_get(key)` unambiguous while the creating Agent remains the owner.

- [ ] Represent grants as embedded values with no cross-Account free text:

```ts
type StateGrant = {
  agentId: string;
  access: 'read' | 'read_write';
  grantedAt: Date;
  grantedByAgentId: string;
};
```

- [ ] Implement `jsonByteSize(value)` as `Buffer.byteLength(JSON.stringify(value), 'utf8')`. Reject `undefined`, functions, symbols, `BigInt`, non-finite numbers, cyclic objects, and serialized output over 65,536 bytes.

- [ ] Model `StateRecord` with `stateId`, Account and owner Agent IDs, key, value, byte size, version starting at 1, grants, optional `expiresAt`, status `active | deleted | expired`, `deletedAt`, `purgeAfter`, and timestamps. Add list, expiry, and Trash indexes.

- [ ] Run `npm test -- __tests__/state/models.test.ts __tests__/state/size.test.ts`; expect schema and byte-boundary tests to pass.

- [ ] Commit:

```bash
git add models/StateRecord.ts lib/state/schemas.ts lib/state/size.ts __tests__/state
git commit -m "feat: model private versioned state"
```

## Task 2: Extend usage accounting for atomic State byte changes

**Files:**

- Modify: `lib/billing/usage.ts`
- Modify: `models/UsageWindow.ts`
- Test: `__tests__/billing/state-usage.test.ts`

- [ ] Write concurrency tests for `adjustActiveStorage(accountId, 'stateBytes', delta, now)`: positive deltas stop exactly at the plan limit; zero and negative deltas continue at the limit; stored usage never becomes negative.

- [ ] Store active State and File byte counters on `Account`, while Events remain monthly counters in `UsageWindow`. Keep one atomic usage-service API even though the backing counters have different reset behavior.

- [ ] Implement reservation tokens or transaction-scoped adjustments so a failed State mutation cannot leak quota. Recomputing usage is a repair path, not the normal write path.

- [ ] Run `npm test -- __tests__/billing/state-usage.test.ts __tests__/billing/usage.test.ts`; expect exact-limit and rollback tests to pass.

- [ ] Commit:

```bash
git add lib/billing/usage.ts models/UsageWindow.ts __tests__/billing/state-usage.test.ts
git commit -m "feat: account for state storage atomically"
```

## Task 3: Implement State set, get, list, and compare-and-set

**Files:**

- Create: `lib/state/service.ts`
- Create: `lib/state/presenter.ts`
- Test: `__tests__/state/service.test.ts`
- Test: `__tests__/state/concurrency.test.ts`

- [ ] Write tests for create at version 1, update to version 2, last-write-wins update without `expectedVersion`, successful compare-and-set, stale compare-and-set, get/list pagination, expired invisibility, deleted invisibility, and owner/Agent isolation.

- [ ] Define `state_set` semantics explicitly:

```ts
type StateSetInput = {
  key: string;
  value: JsonValue;
  expectedVersion?: number;
  expiresAt?: string | null;
};
```

- [ ] When `expectedVersion` is absent, create or update atomically. When present, the current active version must match. `expectedVersion: 0` means create only. Return `version_conflict` with the current version but not the current value.

- [ ] In one transaction, resolve actor access, compute old/new size delta, reserve positive quota, update with a version predicate, and roll back quota on conflict. Increment version on every value or expiry change.

- [ ] Allow the owner Agent and `read_write` grantees to set an existing record. Any Agent may create an unused Account key and becomes its owner; an inaccessible existing key still returns `not_found` rather than revealing it. `state_get` and `state_list` include owned and granted active records.

- [ ] Present `stateId`, owner Agent, key, exact JSON value, version, access level, timestamps, expiry, and byte size. Do not expose internal Account ID, Mongo ID, or grants unrelated to the caller.

- [ ] Run `npm test -- __tests__/state/service.test.ts __tests__/state/concurrency.test.ts`; expect all CAS races to have exactly one winner per expected version.

- [ ] Commit:

```bash
git add lib/state/service.ts lib/state/presenter.ts __tests__/state/service.test.ts __tests__/state/concurrency.test.ts
git commit -m "feat: add versioned state operations"
```

## Task 4: Implement grants, revocation, deletion, and restoration

**Files:**

- Modify: `lib/state/service.ts`
- Create: `app/api/state/route.ts`
- Create: `app/api/state/[stateId]/route.ts`
- Create: `app/api/state/[stateId]/access/route.ts`
- Create: `app/api/trash/state/[stateId]/restore/route.ts`
- Test: `__tests__/state/access.test.ts`
- Test: `__tests__/state/lifecycle.test.ts`
- Test: `__tests__/state/owner-routes.test.ts`

- [ ] Write tests that only the owner Agent can grant/revoke Agent access, grants require a target Agent in the same Account, duplicate grant updates access instead of duplicating, revocation is immediate, and Account owners can override access.

- [ ] Implement `shareState(actor, key, targetAgentId, access)` and `revokeState(actor, key, targetAgentId)` with owner-Agent checks. A grantee cannot reshare.

- [ ] Implement Agent deletion as immediate `status: deleted`, release active State bytes, clear no content, and set `purgeAfter` to seven days. Owner restore must atomically reserve storage again; if the plan limit is reached, return `plan_limit_reached` and leave the record in Trash.

- [ ] Treat natural expiry as terminal: set `status: expired`, release active bytes, and do not offer restore. Physical purge is handled by the lifecycle plan.

- [ ] Add Firebase-owner routes for safe Data views, grant override, delete, permanent delete, and restore. Permanent delete must require the exact State ID and a confirmation token generated for that owner session.

- [ ] Run `npm test -- __tests__/state/access.test.ts __tests__/state/lifecycle.test.ts __tests__/state/owner-routes.test.ts`; expect all permission and quota restoration tests to pass.

- [ ] Commit:

```bash
git add lib/state/service.ts app/api/state app/api/trash/state __tests__/state
git commit -m "feat: manage state access and lifecycle"
```

## Task 5: Register State MCP tools and matching `/v1` routes

**Files:**

- Create: `lib/state/operations.ts`
- Modify: `lib/contracts/registry.ts`
- Create: `app/v1/state/route.ts`
- Create: `app/v1/state/[key]/route.ts`
- Create: `app/v1/state/[key]/access/route.ts`
- Test: `__tests__/state/operations.test.ts`
- Test: `__tests__/state/contracts.test.ts`

- [ ] Register exactly `state_set`, `state_get`, `state_list`, `state_delete`, `state_share`, and `state_revoke` with the shared service and schemas.

- [ ] Map HTTP as `PUT/GET/DELETE /v1/state/{key}`, `GET /v1/state`, and `PUT/DELETE /v1/state/{key}/access`. Restrict keys so no catch-all or path traversal behavior is required.

- [ ] Mark `state_get` and `state_list` read-only. Mark set/delete/share/revoke mutating. State deletion is destructive but recoverable for seven days; the tool description must say so.

- [ ] Regenerate and test contracts:

```bash
npm run generate:contracts
npm test -- __tests__/state/operations.test.ts __tests__/state/contracts.test.ts __tests__/contracts
```

Expected: all six tools have identical MCP and HTTP schemas, including `expectedVersion` and access mode.

- [ ] Commit:

```bash
git add lib/state/operations.ts lib/contracts/registry.ts app/v1/state public/openapi.json public/llms.txt __tests__/state
git commit -m "feat: expose private state to agents"
```

## Task 6: State vertical-slice gate

**Files:**

- Create: `__tests__/security/state-isolation.test.ts`
- Create: `__tests__/integration/state-journey.test.ts`

- [ ] Test every State operation with two Accounts and two same-Account Agents. Prove private default, read grant, read-write grant, revocation, cross-Account denial, owner override, and no existence leak.

- [ ] Test the complete journey: set JSON, get exact JSON, share, update through a grantee, force a version conflict, revoke, delete, restore, expire, and hit storage capacity.

- [ ] Run:

```bash
npm test
npm run check:contracts
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit `0`; `rg -n "namespace|shared namespace|KV Store" lib/state app/v1/state` returns no legacy product terminology.

- [ ] Commit:

```bash
git add __tests__/security/state-isolation.test.ts __tests__/integration/state-journey.test.ts
git commit -m "test: verify state coordination boundaries"
```
