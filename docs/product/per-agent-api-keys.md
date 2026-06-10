# Per-Agent API Key Isolation

## Problem

When multiple agents share one AgentUtils account (one API key), these issues arise:
- One agent's quota runaway blocks all others
- KV key collisions if agents use the same key names
- Rate limiter buckets shared — one agent throttles another
- No audit attribution — can't tell which agent caused an action
- Revoking access kills all agents, not just the bad one

## Root Fix

Issue one API key per agent. The infrastructure is already built for this.

---

## What Already Works (No Code Changes)

### Multiple keys per user
`POST /api/keys` with `{ name: "agent-scraper" }` creates a new key.
Call this once per agent at deploy time. Key is returned once — store in agent's env.

### KV namespace is already per-apiKey
`KvEntrySchema.index({ apiKeyId: 1, key: 1 }, { unique: true })`
Two agents with different keys can both use a key named `cursor` — no collision. ✅ Done.

### Audit attribution
`validateApiKey()` returns `apiKeyId`. Tools that write audit logs can already tag by agent key.

---

## Required Code Changes

### 1. Usage model — add `apiKeyId` field

In `models/Usage.ts`, add:

```typescript
apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
```

Add compound index:
```typescript
UsageSchema.index({ apiKeyId: 1, periodStart: 1, periodEnd: 1 });
```

In `lib/auth.ts`, scope usage increments by `apiKeyId` instead of `userId`.
Stripe billing rollup still aggregates by `userId`.

### 2. Per-key quota limit (optional)

Add `monthlyLimit` field to `ApiKey` model:
```typescript
monthlyLimit: { type: Number, default: null }, // null = use tier default
```

Enforce in `lib/auth.ts`:
```typescript
if (apiKey.monthlyLimit && apiKey.monthlyCount >= apiKey.monthlyLimit) {
  return { error: 'key_quota_exceeded' };
}
```

Create keys with a limit:
```bash
POST /api/keys
{ "name": "agent-scraper", "monthlyLimit": 500 }
```

### 3. Rate Limiter — scope to `apiKeyId`

Check rate limiter counter storage. If using `userId` as KV namespace key, swap to `apiKeyId`:
```
Current: `rate:${userId}:${endpoint}`
Fix:     `rate:${apiKeyId}:${endpoint}`
```

### 4. Dashboard — key management page

New page: `app/dashboard/keys/page.tsx`

Display per key: name, created date, last used, monthly call count, revoke button.

### 5. DELETE /api/keys/[id] route

New file: `app/api/keys/[id]/route.ts`

```typescript
export async function DELETE(request, { params }) {
  const user = await getAuthenticatedUser();
  await ApiKey.findOneAndUpdate(
    { _id: params.id, userId: user._id },
    { active: false }
  );
  return successResponse({ revoked: true });
}
```

---

## Agent Provisioning Pattern

At deploy time — human does this once per agent:

```bash
curl -X POST https://agentutils.dev/api/keys \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "prod-scraper-agent"}'

# Returns: { "key": "au_abc123..." }
# Store in agent's environment: AGENTUTILS_API_KEY=au_abc123...
```

Each agent process holds its own key.
To kill one agent's access: revoke that key. Others unaffected.

---

## Implementation Effort

| Change | File(s) | Effort |
|--------|---------|--------|
| KV per-key namespace | ✅ Already done | — |
| Usage add `apiKeyId` | `models/Usage.ts`, `lib/auth.ts` | ~1 hour |
| Per-key `monthlyLimit` | `models/ApiKey.ts`, `lib/auth.ts` | ~30 min |
| Rate limiter `apiKeyId` scope | rate limiter route/lib | ~30 min |
| Dashboard key management page | `app/dashboard/keys/page.tsx` | ~2 hours |
| `DELETE /api/keys/[id]` route | `app/api/keys/[id]/route.ts` | ~30 min |

**Total: ~4.5 hours**

---

## Priority

- **P1** — Needed before any multi-agent customer onboards. Without this, one agent can starve or interfere with another.
