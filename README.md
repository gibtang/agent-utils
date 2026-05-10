# AgentUtils

A centralized API platform providing 11 specialized utilities designed for AI agents. A single API key gives access to multiple tools that solve common pain points in agent development — file handling, error recovery, human oversight, privacy, and notifications.

## Tools

1. **Ephemeral File Host** — Temporary file storage for agents with auto-expiration (1–72 hours by tier)
2. **Dead Letter Queue** — Catches failed agent tasks, stores payloads for inspection/retry
3. **Human-in-the-Loop Gate** — Pauses agents for human approval via webhooks
4. **Agent Shield** — PII redaction proxy (clean before LLM, hydrate after)
5. **AgentVerify OTP** — Temporary phone numbers for agent 2FA verification
6. **Notification Router** — Unified notifications (email, SMS, Slack)
7. **KV Store** — Key-value storage for agent state/memory
8. **Audit Log** — Compliance logging for agent actions
9. **Rate Limiter** — Rate limiting and queuing for API calls
10. **Webhook Inbox** — Webhook catching and forwarding
11. **Agent Form** — Dynamic form generation for human input

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Database:** MongoDB (Mongoose)
- **Auth:** Firebase (client + admin SDKs)
- **Storage:** AWS S3
- **Payments:** Stripe (subscriptions + usage-based billing)
- **Notifications:** Twilio (SMS), Resend (email)

## Pricing

| Tier | Price | Calls/mo | Overage |
|------|-------|----------|---------|
| Free | $0 | 500 | Hard cap |
| Builder | $19/mo | 10,000 | $0.002/call |
| Pro | $49/mo | 100,000 | $0.001/call |
| Enterprise | Custom | Unlimited | — |

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in Firebase, MongoDB, Stripe, S3, Twilio, Resend credentials
npm run dev
```

## Project Structure

```
app/          # Next.js pages (landing, dashboard, tool docs, auth)
app/api/      # REST API endpoints for all tools + billing
lib/          # Core utilities (auth, pricing, storage, rate limiting)
models/       # Mongoose schemas (User, ApiKey, DeadLetter, Checkpoint, etc.)
contexts/     # React context providers
```

## Functionality
Utilities and tools for AI agent development.
