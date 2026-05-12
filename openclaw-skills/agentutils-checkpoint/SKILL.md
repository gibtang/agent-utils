---
name: agentutils-checkpoint
description: Pause AI agents for human approval and resume them. Create checkpoints where agents sleep until a human approves or rejects. Use when an agent needs human-in-the-loop confirmation, approval before proceeding, or manual review of agent state. Trigger words: checkpoint, human approval, pause agent, resume agent, human-in-the-loop, HITL, approval gate, agent sleep.
---

# AgentUtils Checkpoint

Pause agents for human approval. Resume when approved.

## API Base

`https://www.agent-utils.com/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://www.agent-utils.com/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-checkpoint.sh <command> [arguments]
```

### `create <agent_name> <task_description> <webhook_url> [state_json]`

Create a checkpoint. Agent sleeps until human approves/rejects. On approval, the state is POSTed to `webhook_url`.

```bash
scripts/agentutils-checkpoint.sh create "deploy-bot" "Deploy v2.1 to production" "https://example.com/webhook" '{"version":"2.1","env":"prod"}'
```

### `list [page] [limit]`

List all checkpoints.

```bash
scripts/agentutils-checkpoint.sh list
```

### `poll <id>`

Check checkpoint status (pending/approved/rejected).

```bash
scripts/agentutils-checkpoint.sh poll abc123def456
```

### `resume <id> <approve|reject> [reason]`

Approve or reject a checkpoint.

```bash
scripts/agentutils-checkpoint.sh resume abc123def456 approve "Looks good"
scripts/agentutils-checkpoint.sh resume abc123def456 reject "Wrong version"
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/checkpoint` | POST | Create checkpoint (agent sleeps) |
| `/api/checkpoint` | GET | List checkpoints |
| `/api/checkpoint/{id}` | GET | Poll checkpoint status |
| `/api/checkpoint/{id}/resume` | POST | Approve or reject |

### Create Example

```bash
curl -X POST https://www.agent-utils.com/api/checkpoint \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "deploy-bot",
    "taskDescription": "Deploy v2.1 to production",
    "state": {"version": "2.1", "env": "prod"},
    "webhookUrl": "https://example.com/webhook"
  }'
```

### Poll Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  https://www.agent-utils.com/api/checkpoint/abc123def456
```

### Approve Example

```bash
curl -X POST https://www.agent-utils.com/api/checkpoint/abc123def456/resume \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "reason": "Looks good"}'
```

## Response Format

**Create response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "status": "pending",
    "agentName": "deploy-bot",
    "taskDescription": "Deploy v2.1 to production",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

**Poll response (approved):**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "status": "approved",
    "state": {"version": "2.1", "env": "prod"},
    "resolvedAt": "2025-01-15T10:05:00Z"
  }
}
```

## Tips

- Include full agent state in `state` field so it can be restored on resume
- The `webhookUrl` receives the approved state as a POST body
- Poll periodically (every 5-10 seconds) to check if human has responded
- Use descriptive `taskDescription` so humans know what they're approving
