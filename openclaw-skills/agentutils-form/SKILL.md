---
name: agentutils-form
description: Create and manage forms for AI agents to collect structured input from humans. Generate form URLs, define fields, and receive submissions via webhook. Use when an agent needs user input, structured data collection, feedback forms, configuration forms, or human data entry. Trigger words: agent form, collect input, user form, feedback form, data collection, structured input, form builder, survey. Requires paid plan.
---

# AgentUtils Agent Form

Create forms for AI agents to collect structured human input. Share a URL, get submissions via webhook.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-form.sh <command> [arguments]
```

### `create <title> <fields_json> <webhook_url> [ttl_seconds]`

Create a form. Fields is a JSON array of field definitions. Default TTL: 7 days.

```bash
scripts/agentutils-form.sh create "User Feedback" \
  '[{"name":"rating","label":"Rating","type":"number"},{"name":"comments","label":"Comments","type":"textarea"}]' \
  "https://example.com/webhook"
```

### `list [limit]`

List all forms and their response counts.

```bash
scripts/agentutils-form.sh list
```

### `get <id>`

Get form details including fields and response count.

```bash
scripts/agentutils-form.sh get abc123def456
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/form` | POST | Create a form |
| `/api/form?limit=&offset=` | GET | List forms |
| `/api/form/{id}` | GET | Get form details |

### Create Example

```bash
curl -X POST https://agentutils.dev/api/form \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "User Feedback",
    "fields": [
      {"name": "name", "label": "Your Name", "type": "text"},
      {"name": "email", "label": "Email", "type": "email"},
      {"name": "rating", "label": "Rating (1-5)", "type": "number"},
      {"name": "comments", "label": "Comments", "type": "textarea"},
      {"name": "satisfied", "label": "Are you satisfied?", "type": "checkbox"}
    ],
    "webhookUrl": "https://example.com/webhook",
    "ttl": 604800
  }'
```

### List Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  "https://agentutils.dev/api/form?limit=10"
```

## Response Format

**Create response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "token": "uuid-token",
    "url": "https://agentutils.dev/f/uuid-token",
    "title": "User Feedback",
    "status": "active"
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
        "title": "User Feedback",
        "status": "active",
        "responseCount": 5,
        "url": "https://agentutils.dev/f/token",
        "expiresAt": "2025-01-22T10:00:00Z"
      }
    ],
    "total": 2
  }
}
```

## Supported Field Types

| Type | Description |
|------|-------------|
| `text` | Single-line text input |
| `email` | Email address with validation |
| `number` | Numeric input |
| `textarea` | Multi-line text |
| `select` | Dropdown selection (provide `options` array) |
| `checkbox` | Boolean toggle |

## Tips

- The returned `url` (`/f/{token}`) is shareable — send it to anyone who needs to fill the form
- Submissions are POSTed to `webhookUrl` as JSON
- Set `ttl` for auto-expiry (default: 7 days / 604800 seconds)
- Each field needs `name`, `label`, and `type`
- Forms auto-expire — use shorter TTL for one-time collection
