---
name: agentutils-webhook
description: Create temporary webhook inboxes for AI agents. Capture incoming webhooks, inspect payloads, and forward to agent endpoints. Use when an agent needs to receive webhooks, capture HTTP callbacks, test webhook integrations, or inspect incoming requests. Trigger words: webhook inbox, receive webhook, webhook capture, webhook test, incoming webhook, HTTP callback, webhook URL. Requires paid plan.
---

# AgentUtils Webhook Inbox

Temporary webhook inboxes for AI agents. Capture, inspect, and forward webhooks.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-webhook.sh <command> [arguments]
```

### `create [label] [forward_url] [ttl_seconds]`

Create a webhook inbox. Returns a unique URL that captures incoming requests. Default TTL: 24 hours.

```bash
scripts/agentutils-webhook.sh create "Stripe webhooks" "https://example.com/process"
scripts/agentutils-webhook.sh create "test-inbox"
```

### `list [limit]`

List all webhook inboxes and their message counts.

```bash
scripts/agentutils-webhook.sh list
scripts/agentutils-webhook.sh list 10
```

### `messages <id>`

Get all captured messages for an inbox.

```bash
scripts/agentutils-webhook.sh messages abc123def456
```

### `delete <id>`

Delete a webhook inbox and all its messages.

```bash
scripts/agentutils-webhook.sh delete abc123def456
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook` | POST | Create webhook inbox |
| `/api/webhook?limit=&offset=` | GET | List webhook inboxes |
| `/api/webhook/{id}` | GET | Get inbox detail with messages |
| `/api/webhook/{id}` | DELETE | Delete inbox |

### Create Example

```bash
curl -X POST https://agentutils.dev/api/webhook \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Stripe webhooks",
    "forwardUrl": "https://example.com/process",
    "ttl": 86400
  }'
```

### List Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  "https://agentutils.dev/api/webhook?limit=10"
```

## Response Format

**Create response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "token": "uuid-token",
    "url": "https://agentutils.dev/hook/uuid-token",
    "label": "Stripe webhooks",
    "expiresAt": "2025-01-16T10:00:00Z"
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
        "url": "https://agentutils.dev/hook/token",
        "label": "Stripe webhooks",
        "messageCount": 15,
        "expiresAt": "2025-01-16T10:00:00Z"
      }
    ],
    "total": 3
  }
}
```

## Tips

- The returned `url` (`/hook/{token}`) is public — anyone with it can send webhooks
- Set `forwardUrl` to auto-forward captured webhooks to your agent endpoint
- Inboxes auto-expire based on TTL (default 24 hours)
- Use `label` to organize multiple inboxes
- Check `messageCount` to see how many webhooks have been captured
