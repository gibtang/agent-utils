---
name: agentutils-notify
description: Send email notifications from AI agents. Route alerts, updates, and reports to email inboxes. Use when an agent needs to send an email, notify a user, send an alert, or deliver a report via email. Trigger words: send email, notify, notification, alert, email agent, agent notification, send alert, email report.
---

# AgentUtils Notification Router

Send email notifications from AI agents. One API call, delivered to any inbox.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-notify.sh <command> [arguments]
```

### `send <message> [priority] [to] [subject]`

Send an email notification. Priority: `urgent`, `normal` (default), `low`.

```bash
scripts/agentutils-notify.sh send "Deploy v2.1 completed successfully" normal "dev@example.com" "Deploy Status"
scripts/agentutils-notify.sh send "Critical: API error rate above 5%" urgent
```

### `list [status] [priority] [limit]`

List notification history.

```bash
scripts/agentutils-notify.sh list delivered normal 10
scripts/agentutils-notify.sh list
```

### `get <id>`

Get notification details and delivery status.

```bash
scripts/agentutils-notify.sh get abc123def456
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notify` | POST | Send notification |
| `/api/notify?status=&priority=&limit=&offset=` | GET | List notification history |
| `/api/notify/{id}` | GET | Get notification detail |

### Send Example

```bash
curl -X POST https://agentutils.dev/api/notify \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Deploy v2.1 completed successfully",
    "priority": "normal",
    "to": "dev@example.com",
    "subject": "Deploy Status",
    "metadata": {"version": "2.1", "env": "prod"}
  }'
```

### List Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  "https://agentutils.dev/api/notify?status=delivered&limit=10"
```

## Response Format

**Send response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "status": "sent",
    "priority": "normal",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

## Tips

- Set `priority` to `urgent` for time-sensitive alerts
- Include `metadata` object for structured data (version numbers, URLs, etc.)
- Check notification history to verify delivery
- Use `subject` for clear email subject lines
