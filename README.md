# AgentUtils — API Utilities for AI Agents

> One API key. 11 tools. Ship agents faster.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/gibtang/agent-utils)](https://github.com/gibtang/agent-utils/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/gibtang/agent-utils)](https://github.com/gibtang/agent-utils/issues)

**The missing infrastructure layer for AI agents.** File hosting, PII redaction, dead letter queues, human-in-the-loop gates, and 7 more tools — all behind one API key.

## Why AgentUtils?

Building agents? You keep reimplementing the same plumbing:

- 🗂️ File handling — upload, temp storage, expiry
- 🛡️ PII redaction — clean before LLM, restore after
- 🚨 Error recovery — catch failures, inspect, retry
- 👤 Human approval — pause agents until approved
- 🔔 Notifications — reach a human in one call

AgentUtils gives you all of this as API calls. No infrastructure to manage.

## 🤖 Agent-First

Designed for AI agents, by AI agents:

- [`/llms.txt`](https://www.agent-utils.com/llms.txt) — LLM-discoverable index
- [`/llms-full.txt`](https://www.agent-utils.com/llms-full.txt) — Full API reference in plain text
- [`/openapi.json`](https://www.agent-utils.com/openapi.json) — OpenAPI 3.0 spec
- [MCP Server](https://github.com/gibtang/agent-utils/tree/master/mcp) — Native tool integration for Claude, Cursor, Windsurf

When a developer asks an AI agent *"I need file hosting for my agent"*, the agent finds AgentUtils and knows exactly how to integrate.

## 60-Second Setup

```bash
# 1. Get your API key
curl -X POST https://www.agent-utils.com/api/keys \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "my-agent"}'

# 2. Upload a file
curl -X POST https://www.agent-utils.com/api/file-host \
  -H "x-api-key: au_..." \
  -F "file=@report.csv"

# 3. Send a notification
curl -X POST https://www.agent-utils.com/api/notify \
  -H "x-api-key: au_..." \
  -d '{"message": "Task complete"}'
```

→ [Full API docs](https://www.agent-utils.com/docs)

## 11 Tools

| Tool | Description |
|------|-------------|
| 🗂️ [Ephemeral File Host](https://www.agent-utils.com/tools/file-host) | Temporary file storage with auto-expiration |
| 🪤 [Dead Letter Queue](https://www.agent-utils.com/tools/dlq) | Catch, inspect, and retry failed agent tasks |
| ✋ [Human-in-the-Loop Gate](https://www.agent-utils.com/tools/checkpoint) | Pause agents until humans approve |
| 🛡️ [Agent Shield](https://www.agent-utils.com/tools/shield) | PII redaction proxy — clean before LLM, hydrate after |
| 📱 [AgentVerify OTP](https://www.agent-utils.com/tools/otp) | Temporary phone numbers for agent 2FA |
| 🔔 [Notification Router](https://www.agent-utils.com/tools/notify) | One API call to reach a human (email, SMS, Slack) |
| 🧠 [KV Store](https://www.agent-utils.com/tools/kv) | Key-value storage for agent state and memory |
| 📋 [Audit Log](https://www.agent-utils.com/tools/audit) | Immutable compliance logging for agent actions |
| ⏱️ [Rate Limiter](https://www.agent-utils.com/tools/rate-limiter) | Outbound API rate limiting and queuing |
| 🪝 [Webhook Inbox](https://www.agent-utils.com/tools/webhook) | Pre-provisioned HTTPS endpoints for webhooks |
| 📝 [Agent Form](https://www.agent-utils.com/tools/form) | Dynamic forms for human-in-the-loop data collection |

## Self-Host or Cloud

AgentUtils is open source (AGPL-3.0). Self-host for free, or use our cloud:

| Tier | Price | Calls/mo | Overage |
|------|-------|----------|---------|
| Free | $0 | 500 | Hard cap |
| Builder | $19/mo | 10,000 | $0.002/call |
| Pro | $49/mo | 100,000 | $0.001/call |
| Enterprise | Custom | Unlimited | — |

→ [Start building free](https://www.agent-utils.com/signup)

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Database:** MongoDB (Mongoose)
- **Auth:** Firebase
- **Storage:** AWS S3
- **Payments:** Stripe
- **Notifications:** Twilio (SMS), Resend (email)

## Development

```bash
git clone https://github.com/gibtang/agent-utils.git
cd agent-utils
npm install
cp .env.example .env.local
# Fill in Firebase, MongoDB, Stripe, S3, Twilio, Resend credentials
npm run dev
```

## Contributing

We love contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Good first issues are labeled [`good first issue`](https://github.com/gibtang/agent-utils/labels/good%20first%20issue).

## License

AGPL-3.0 — use freely, contribute back, or use our cloud to skip self-hosting. See [LICENSE](LICENSE).
