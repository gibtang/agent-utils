---
name: agentutils-shield
description: Redact and restore PII (Personally Identifiable Information) in agent text. Strip sensitive data before sending to LLMs and restore original values in responses. Use when an agent handles sensitive data, needs to redact PII before LLM calls, or protect user privacy. Trigger words: PII redaction, data masking, privacy, redact, shield, scrub PII, sensitive data, GDPR, data protection. Requires Pro or higher plan.
---

# AgentUtils Agent Shield

PII redaction and hydration for AI agents. Redact sensitive data before LLM calls, restore after.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard. Requires **Pro** plan or higher.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-shield.sh <command> [arguments]
```

### `clean <text>`

Redact PII from text. Returns redacted text and a session ID for later restoration.

```bash
scripts/agentutils-shield.sh clean "Hi, I'm John Doe. My SSN is 123-45-6789 and email is john@example.com"
```

### `hydrate <text> <session_id>`

Restore original PII values in text using a session ID from a previous clean call.

```bash
scripts/agentutils-shield.sh hydrate "Hello [REDACTED_NAME], your email [REDACTED_EMAIL] is confirmed" "sess_abc123"
```

### `info`

Get shield service info and supported PII types.

```bash
scripts/agentutils-shield.sh info
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shield` | GET | Shield info and supported PII types |
| `/api/shield/clean` | POST | Redact PII from text |
| `/api/shield/hydrate` | POST | Restore original PII values |

### Clean Example

```bash
curl -X POST https://agentutils.dev/api/shield/clean \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hi, I'\''m John Doe. My SSN is 123-45-6789."}'
```

### Hydrate Example

```bash
curl -X POST https://agentutils.dev/api/shield/hydrate \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello [REDACTED], your info is ready", "sessionId": "sess_abc123"}'
```

## Response Format

**Clean response:**
```json
{
  "success": true,
  "data": {
    "text": "Hi, I'm [NAME_1]. My SSN is [SSN_1].",
    "sessionId": "sess_abc123",
    "redactions": [
      {"placeholder": "[NAME_1]", "type": "person_name"},
      {"placeholder": "[SSN_1]", "type": "ssn"}
    ]
  }
}
```

**Hydrate response:**
```json
{
  "success": true,
  "data": {
    "text": "Hi, I'm John Doe. My SSN is 123-45-6789."
  }
}
```

## Tips

- **Workflow**: Clean before LLM call -> LLM processes redacted text -> Hydrate the LLM response
- Save the `sessionId` — you need it to restore original values
- Redaction detects: names, emails, SSNs, phone numbers, addresses, credit cards, and more
- Requires Pro plan ($49/mo) or higher
