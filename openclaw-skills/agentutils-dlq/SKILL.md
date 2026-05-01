---
name: agentutils-dlq
description: Capture, inspect, and retry failed AI agent tasks with a dead letter queue. Store error payloads and original inputs for debugging. Retry failures via webhook. Use when an agent task fails, errors need to be captured, or failed operations need retry. Trigger words: dead letter queue, failed task, retry, error handling, failure capture, DLQ, error queue.
---

# AgentUtils Dead Letter Queue

Catch failed agent tasks. Inspect payloads. Retry with one call.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-dlq.sh <command> [arguments]
```

### `capture <agent_name> <task_type> <error> [retry_webhook]`

Capture a failure with the error payload.

```bash
scripts/agentutils-dlq.sh capture "my-agent" "api-call" "External API returned 500" "https://example.com/retry"
```

### `list [status] [page] [limit]`

List captured failures. Status can be `pending`, `retried`, `dismissed`.

```bash
scripts/agentutils-dlq.sh list pending 1 20
scripts/agentutils-dlq.sh list
```

### `inspect <id>`

Get full failure details including original payload and error context.

```bash
scripts/agentutils-dlq.sh inspect abc123def456
```

### `retry <id>`

Retry a failure — forwards the original payload to the retry webhook.

```bash
scripts/agentutils-dlq.sh retry abc123def456
```

### `dismiss <id>`

Dismiss a failure (marks as resolved without retrying).

```bash
scripts/agentutils-dlq.sh dismiss abc123def456
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dlq` | POST | Capture a failure |
| `/api/dlq?status=&page=&limit=` | GET | List failures |
| `/api/dlq/{id}` | GET | Inspect failure details |
| `/api/dlq/{id}` | DELETE | Dismiss failure |
| `/api/dlq/{id}/retry` | POST | Retry (forward payload to webhook) |

### Capture Example

```bash
curl -X POST https://agentutils.dev/api/dlq \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "data-pipeline",
    "taskType": "api-call",
    "payload": {"endpoint": "/users", "method": "GET"},
    "error": "Connection timeout after 30s",
    "retryWebhook": "https://example.com/retry"
  }'
```

### List Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  "https://agentutils.dev/api/dlq?status=pending&page=1&limit=20"
```

## Response Format

**Capture response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "status": "pending"
  }
}
```

**List response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "abc123",
        "agentName": "data-pipeline",
        "taskType": "api-call",
        "error": "Connection timeout",
        "status": "pending",
        "createdAt": "2025-01-15T10:00:00Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

## Tips

- Always include `retryWebhook` when capturing so you can retry later
- Use `status` filter to focus on `pending` failures that need attention
- Inspect full payloads before retrying to understand the failure context
- Dismiss failures that are known and won't be retried
