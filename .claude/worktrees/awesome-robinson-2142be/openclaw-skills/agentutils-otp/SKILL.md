---
name: agentutils-otp
description: Provision temporary phone numbers for OTP verification. Agents can receive SMS verification codes without exposing real phone numbers. Use when an agent needs to verify a phone number, receive SMS OTP codes, or complete phone-based verification flows. Trigger words: OTP, one-time password, SMS verification, phone verification, temporary number, virtual number, verification code. Note: Virtual numbers are blocked by WhatsApp, Google, Meta, and major crypto exchanges — works for niche platforms and internal systems. Requires Pro or higher plan.
---

# AgentUtils AgentVerify OTP

Temporary phone numbers for OTP verification. Receive SMS codes programmatically.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard. Requires **Pro** plan or higher.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-otp.sh <command> [arguments]
```

### `provision [country_code]`

Provision a temporary phone number. Returns the phone number and session ID.

```bash
scripts/agentutils-otp.sh provision
scripts/agentutils-otp.sh provision US
```

### `list`

List active OTP sessions.

```bash
scripts/agentutils-otp.sh list
```

### `poll <id>`

Poll for the received OTP code.

```bash
scripts/agentutils-otp.sh poll abc123def456
```

### `cancel <id>`

Cancel an OTP session and release the number.

```bash
scripts/agentutils-otp.sh cancel abc123def456
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/otp` | POST | Provision temporary number |
| `/api/otp` | GET | List active OTP sessions |
| `/api/otp/{id}` | GET | Poll for OTP code |
| `/api/otp/{id}` | DELETE | Cancel OTP session |

### Provision Example

```bash
curl -X POST https://agentutils.dev/api/otp \
  -H "x-api-key: au_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"countryCode": "US"}'
```

### Poll Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  https://agentutils.dev/api/otp/abc123def456
```

## Response Format

**Provision response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "phoneNumber": "+1234567890",
    "countryCode": "US",
    "status": "waiting",
    "expiresAt": "2025-01-15T11:00:00Z"
  }
}
```

**Poll response (code received):**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "status": "received",
    "code": "482916",
    "receivedAt": "2025-01-15T10:02:30Z"
  }
}
```

## Limitations

Virtual numbers are blocked by major platforms. **Does NOT work with:**
- WhatsApp
- Google
- Meta (Facebook/Instagram)
- Major crypto exchanges

**Works for:** niche platforms, internal systems, testing environments, non-mainstream services.

## Tips

- Provision a number, then trigger the SMS/OTP flow from your application
- Poll every 5-10 seconds until `status` changes from `waiting` to `received`
- Numbers auto-expire after 1 hour — cancel early if done
- Requires Pro plan ($49/mo) or higher
