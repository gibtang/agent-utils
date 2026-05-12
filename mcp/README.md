# Agent-Utils MCP Server

Streamable HTTP MCP server that wraps all 11 [agent-utils.com](https://www.agent-utils.com) API endpoints as AI agent tools.

## Quick Start

```bash
cd mcp && npm install && npm start
```

Server runs on `http://localhost:3100/mcp`.

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_UTILS_URL` | `https://www.agent-utils.com` | API base URL |
| `AGENT_UTILS_API_KEY` | — | Your API key |
| `MCP_PORT` | `3100` | Server port |

### Claude Desktop / Cursor / Windsurf

```json
{
  "mcpServers": {
    "agent-utils": {
      "url": "http://localhost:3100/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Stdio (alternative)

For stdio transport, use a tool like `supergateway`:

```bash
npx supergateway --streamableHttp http://localhost:3100/mcp
```

## Tools (11 total)

| Tool | Description |
|---|---|
| `health` | Check API health |
| `create_api_key` / `list_api_keys` | Manage API keys |
| `upload_file` | Upload files, get public URLs |
| `dlq_push` / `dlq_list` | Dead Letter Queue for failed messages |
| `create_checkpoint` / `get_checkpoint` | Human-in-the-Loop approval gates |
| `redact_pii` / `hydrate_pii` | PII redaction and restoration |
| `request_otp` / `check_otp` | Temporary phone numbers for OTP |
| `send_notification` / `get_notification` | Email notifications |
| `log_audit` / `list_audit` | Audit trail for agent actions |
| `kv_set` / `kv_get` / `kv_delete` | Persistent key-value storage |
| `rate_limit_check` / `rate_limit_reset` | Token-bucket rate limiting |
| `create_webhook_inbox` / `list_webhook_inboxes` / `get_webhook_inbox` | Temporary webhook endpoints |
| `create_form` / `get_form` | Web forms for human input |

## License

AGPL-3.0-only
