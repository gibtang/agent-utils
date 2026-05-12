---
name: agentutils-audit
description: Log and query audit trails for AI agent actions. Record what agents did, when, and why. Filter by agent, action type, severity, and date range. Use when an agent needs audit logging, compliance tracking, action history, or debugging agent behavior. Trigger words: audit log, audit trail, action log, compliance, agent history, activity log, logging, agent tracking.
---

# AgentUtils Audit Log

Audit trails for AI agent actions. Record, query, and debug agent behavior.

## API Base

`https://www.agent-utils.com/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://www.agent-utils.com/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-audit.sh <command> [arguments]
```

### `log <action> [agent_name] [severity] [target] [metadata_json]`

Log an agent action. Severity: `info` (default), `warn`, `error`, `critical`.

```bash
scripts/agentutils-audit.sh log "deploy.completed" "deploy-bot" "info" "production" '{"version":"2.1"}'
scripts/agentutils-audit.sh log "api.failure" "data-agent" "error"
```

### `list [agent] [action] [severity] [limit]`

Query audit logs with filters.

```bash
scripts/agentutils-audit.sh list
scripts/agentutils-audit.sh list "deploy-bot" "" "error" 20
scripts/agentutils-audit.sh list "" "deploy" "" 50
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/audit` | POST | Log an action |
| `/api/audit?agent=&action=&severity=&startDate=&endDate=&limit=&offset=` | GET | Query logs |
| `/api/audit/{id}` | GET | Get log detail |

### Log Example

```bash
curl -X POST https://www.agent-utils.com/api/audit \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "deploy-bot",
    "action": "deploy.completed",
    "target": "production",
    "severity": "info",
    "metadata": {"version": "2.1", "duration": "45s"}
  }'
```

### Query Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  "https://www.agent-utils.com/api/audit?agent=deploy-bot&severity=error&limit=20"
```

## Response Format

**Log response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "createdAt": "2025-01-15T10:00:00Z"
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
        "agentName": "deploy-bot",
        "action": "deploy.completed",
        "target": "production",
        "severity": "info",
        "metadata": {"version": "2.1"},
        "createdAt": "2025-01-15T10:00:00Z"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

## Tips

- Use consistent `action` naming (e.g., `entity.verb`: `deploy.started`, `deploy.completed`)
- Set appropriate severity levels for filtering later
- Include `metadata` for structured context that helps with debugging
- Filter by date range (`startDate`, `endDate`) for time-bound queries
- Logs are scoped per API key
