---
name: agentutils-kv
description: Persistent key-value storage for AI agents. Store and retrieve state, counters, and configuration across agent runs. Use when an agent needs to remember data between invocations, store shared state, increment counters, or persist configuration. Trigger words: key-value store, KV store, agent state, persist data, counter, agent memory, shared state. Requires paid plan.
---

# AgentUtils KV Store

Persistent key-value storage for AI agents. Remember data across runs.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-kv.sh <command> [arguments]
```

### `set <key> <value> [ttl_seconds]`

Set a key-value pair. TTL defaults to 86400 seconds (24 hours).

```bash
scripts/agentutils-kv.sh set "last-run-id" "abc123" 3600
scripts/agentutils-kv.sh set "config" '{"model":"gpt-4","temp":0.7}'
```

### `get <key>`

Get the value for a key.

```bash
scripts/agentutils-kv.sh get "last-run-id"
```

### `list [limit] [offset]`

List all keys (without values). Default limit: 50.

```bash
scripts/agentutils-kv.sh list
scripts/agentutils-kv.sh list 100 0
```

### `increment <key> [amount]`

Increment a numeric value. Defaults to +1. Creates key with value 0 if not exists.

```bash
scripts/agentutils-kv.sh increment "api-call-count"
scripts/agentutils-kv.sh increment "batch-total" 10
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/kv` | PUT | Set key-value pair |
| `/api/kv` | GET | List all keys |
| `/api/kv/{key}` | GET | Get value by key |
| `/api/kv/{key}/increment` | POST | Increment numeric value |

### Set Example

```bash
curl -X PUT https://agentutils.dev/api/kv \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "last-run-id", "value": "abc123", "ttl": 3600}'
```

### Get Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  https://agentutils.dev/api/kv/last-run-id
```

### Increment Example

```bash
curl -X POST https://agentutils.dev/api/kv/api-call-count/increment \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1}'
```

## Response Format

**Set response:**
```json
{
  "success": true,
  "data": {
    "key": "last-run-id",
    "expiresAt": "2025-01-16T10:00:00Z"
  }
}
```

**Get response:**
```json
{
  "success": true,
  "data": {
    "key": "last-run-id",
    "value": "abc123",
    "expiresAt": "2025-01-16T10:00:00Z"
  }
}
```

**Increment response:**
```json
{
  "success": true,
  "data": {
    "key": "api-call-count",
    "value": 43
  }
}
```

## Tips

- Keys are scoped per API key — different agents with different keys get isolated storage
- Values can be any JSON type (string, number, object, array)
- Set TTL to control auto-expiry (default 24 hours)
- Use `increment` for counters — it's atomic and avoids race conditions
- Max key length: 256 characters
