---
name: agentutils-rate-limit
description: Rate limiting as a service for AI agents. Check if an action is within rate limits, enforce quotas, and reset counters. Use when an agent needs to rate limit API calls, enforce usage quotas, prevent abuse, or throttle operations. Trigger words: rate limit, throttle, quota, rate limiting, limit check, too many requests, abuse prevention. Requires paid plan.
---

# AgentUtils Rate Limiter

Rate limiting as a service for AI agents. Check limits, enforce quotas.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-rate-limit.sh <command> [arguments]
```

### `check <key> <limit> <window_seconds>`

Check if an action is within rate limits. Returns `allowed: true/false` with remaining count.

```bash
scripts/agentutils-rate-limit.sh check "api-calls" 100 3600
scripts/agentutils-rate-limit.sh check "user:123:actions" 10 60
```

### `status <key>`

Get current rate limit status for a key.

```bash
scripts/agentutils-rate-limit.sh status "api-calls"
```

### `reset <key>`

Reset the rate limit counter for a key.

```bash
scripts/agentutils-rate-limit.sh reset "api-calls"
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rate-limit/check` | POST | Check rate limit |
| `/api/rate-limit/reset` | POST | Reset rate limit counter |
| `/api/rate-limit/{key}` | GET | Get rate limit status |

### Check Example

```bash
curl -X POST https://agentutils.dev/api/rate-limit/check \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "api-calls", "limit": 100, "windowSeconds": 3600}'
```

### Reset Example

```bash
curl -X POST https://agentutils.dev/api/rate-limit/reset \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "api-calls"}'
```

### Status Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  https://agentutils.dev/api/rate-limit/api-calls
```

## Response Format

**Check response (allowed):**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "remaining": 87,
    "limit": 100,
    "resetAt": "2025-01-15T11:00:00Z"
  }
}
```

**Check response (rate limited):**
```json
{
  "success": true,
  "data": {
    "allowed": false,
    "remaining": 0,
    "limit": 100,
    "retryAfter": 2340,
    "resetAt": "2025-01-15T11:00:00Z"
  }
}
```

## Tips

- Use descriptive keys to namespace different rate limits (e.g., `user:123:api-calls`)
- `windowSeconds` defines the sliding window (3600 = 1 hour, 60 = 1 minute)
- Returns HTTP 200 when allowed, HTTP 429 when rate limited
- Reset counters when testing or after corrective actions
