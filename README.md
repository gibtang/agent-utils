# AgentUtils — API Utilities for AI Agents

> **One API key. Infrastructure tools for AI agents. Ship faster.**

**AgentUtils is the missing infrastructure layer for AI agents.** AI agents are stateless, sandboxed, and credential-less — they can't handle errors after they crash, or wait for human approval. AgentUtils provides production-ready infrastructure tools as simple REST API calls behind a single API key. Two tools are live now (Dead Letter Queue and Human-in-the-Loop Checkpoints), with more on the roadmap.

**Who is it for?** AI agent developers using OpenAI, Anthropic, LangChain, CrewAI, AutoGen, or any agent framework who need infrastructure primitives but don't want to manage servers, databases, or third-party accounts. No SDKs to install, no credentials to configure — just `curl` and go. Self-hostable under AGPL-3.0, or use the managed cloud at [agent-utils.com](https://www.agent-utils.com).

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/gibtang/agent-utils)](https://github.com/gibtang/agent-utils/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/gibtang/agent-utils)](https://github.com/gibtang/agent-utils/issues)

**The missing infrastructure layer for AI agents.** Dead letter queues, human-in-the-loop gates, and more infrastructure tools — all behind one API key.

**Website:** [agent-utils.com](https://www.agent-utils.com) · **GitHub:** [gibtang/agent-utils](https://github.com/gibtang/agent-utils) · **License:** AGPL-3.0-only · **Author:** A2Z Soft

---

## What It Does

AI agents are **stateless, sandboxed, and credential-less**. Every agent developer ends up rebuilding the same infrastructure plumbing: file storage, error recovery, PII handling, notification delivery, human approval workflows. AgentUtils eliminates that by providing infrastructure tools as simple REST API calls. No infrastructure to manage, no SDKs to install, no credentials to configure.

Each tool solves a problem that agents fundamentally cannot solve on their own because it requires one (or more) of:
1. **Persistent state** — agents terminate between invocations
2. **Network-accessible infrastructure** — agents can't open ports or register public URLs
3. **Pre-provisioned credentials** — agents have no secure way to hold secrets

### Live Tools

| Tool | What It Does | Why Agents Need It |
|------|-------------|-------------------|
| 🪤 **Dead Letter Queue** | Catch, inspect, and retry failed agent tasks | Agent is already dead when failure occurs — platform holds the failure for post-hoc inspection |
| ✋ **Human-in-the-Loop Gate** (Checkpoint) | Pause agents until humans approve via a web UI | Agents can't render UI or wait — platform holds state between the pause and resume calls |

### Planned Tools

| Tool | What It Does | Why Agents Need It |
|------|-------------|-------------------|
| 🗂️ **Ephemeral File Host** | Temporary file storage with auto-expiration (1–72h TTL) | Agents can't write to persistent filesystems; need to share files across invocations |
| 🛡️ **Agent Shield** (PII Redaction) | Clean PII before sending to LLMs, hydrate it back after | Stateful round-trip: `clean()` → LLM call → `hydrate()` requires server-side session state |
| 📱 **AgentVerify OTP** | Temporary phone numbers for agent 2FA/SMS verification | Agents can't hold Twilio credentials or register inbound SMS webhooks |
| 🔔 **Notification Router** | One API call to reach a human via email (SMS/Slack planned) | Zero-config — platform knows the user's email, no SMTP setup needed |
| 🧠 **KV Store** | Key-value storage for agent state, memory, and counters | Agents are stateless — KV provides persistent, API-key-scoped atomic storage |
| 📋 **Audit Log** | Immutable compliance logging for agent actions | User-facing accountability layer — no competitor provides this for agents |
| ⏱️ **Rate Limiter** | Token-bucket rate limiting for outbound API calls | Only rate limiter positioned for protecting *outbound* calls, not your own API |
| 🪝 **Webhook Inbox** | Pre-provisioned HTTPS endpoints for receiving webhooks | Agents have no public URL — platform provides temporary HTTPS endpoints instantly |
| 📝 **Agent Form** | Dynamic web forms for human-in-the-loop data collection | Agents can't render UI — platform generates hosted forms and collects responses |

---

## Key Features

- **Single API key** — all tools behind one key, one billing account
- **Agent-first design** — every endpoint is a single HTTP call with structured JSON in/out
- **LLM-discoverable** — `/llms.txt`, `/llms-full.txt`, and OpenAPI 3.0 spec so AI agents can find and integrate autonomously
- **MCP Server** — native Model Context Protocol server for Claude, Cursor, Windsurf, and any MCP-compatible tool
- **Per-tool limits** — granular quotas per tier (KV keys, file size, webhook inboxes, form count, audit retention)
- **Usage-based billing** — overage pricing beyond included monthly calls
- **Self-hostable** — full source under AGPL-3.0, run it yourself for free
- **SOC-ready audit logging** — immutable, user-visible action history *(planned)*
- **Zero-config notifications** — platform handles SMTP/SMS; user just calls `/api/notify` *(planned)*

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Database** | MongoDB (Mongoose ODM) |
| **Auth** | Firebase Auth (client) + Firebase Admin (server) |
| **Storage** | AWS S3 / Backblaze B2 |
| **Payments** | Stripe (Checkout + Billing webhooks) |
| **Notifications** | Resend (email), Twilio (SMS) |
| **Analytics** | Google Analytics (via `@next/third-parties`) |
| **Testing** | Vitest, mongodb-memory-server, jsdom |
| **Linting** | ESLint (eslint-config-next) |
| **Git Hooks** | Husky |
| **MCP Server** | Node.js (ESM), Streamable HTTP transport |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 16 App                          │
│                     (App Router, SSR)                        │
│                                                              │
│  app/                                                        │
│  ├── page.tsx              ← Landing page                   │
│  ├── login/ / signup/      ← Firebase Auth UI               │
│  ├── dashboard/            ← API key management, usage       │
│  ├── profile/              ← Account & billing settings      │
│  ├── docs/                 ← Per-tool documentation pages     │
│  │   ├── file-host/ dlq/ checkpoint/ shield/                 │
│  │   ├── otp/ notify/ kv/ audit/                             │
│  │   ├── rate-limit/ webhook/ form/                          │
│  │   └── page.tsx          ← Docs index                      │
│  ├── tools/[slug]/         ← Public tool landing pages (SEO) │
│  ├── f/[id]/               ← Agent Form render page          │
│  ├── hook/[token]/         ← Checkpoint approval page        │
│  ├── api/                  ← REST API routes                 │
│  │   ├── keys/             ← API key CRUD                    │
│  │   ├── file-host/        ← File upload/download            │
│  │   ├── dlq/              ← Dead Letter Queue               │
│  │   ├── checkpoint/       ← HITL gate (create/approve)      │
│  │   ├── shield/           ← PII clean + hydrate             │
│  │   │   ├── clean/                                         │
│  │   │   └── hydrate/                                       │
│  │   ├── otp/              ← Phone number provisioning       │
│  │   ├── notify/           ← Email/SMS notifications         │
│  │   ├── kv/               ← Key-value CRUD + increment      │
│  │   ├── audit/            ← Audit log write + query         │
│  │   ├── rate-limit/       ← Token bucket check/reset        │
│  │   ├── webhook/          ← Webhook inbox CRUD + receive    │
│  │   ├── form/             ← Form CRUD                       │
│  │   │   └── form-submit/  ← Form response collection        │
│  │   ├── billing/webhook/  ← Stripe webhook handler          │
│  │   ├── user/             ← User profile API                │
│  │   ├── health/           ← Health check endpoint           │
│  │   ├── docs/             ← OpenAPI JSON spec               │
│  │   └── firebase-config/  ← Client Firebase config          │
│  ├── sitemap.ts            ← Dynamic sitemap generation      │
│  └── robots.ts             ← robots.txt                      │
│                                                              │
│  models/                   ← Mongoose schemas (15 models)    │
│  ├── User.ts               ← Users + subscription tier       │
│  ├── ApiKey.ts             ← API keys                        │
│  ├── Usage.ts              ← Per-key usage tracking          │
│  ├── File.ts               ← File metadata                  │
│  ├── DeadLetter.ts         ← DLQ entries                     │
│  ├── Checkpoint.ts         ← HITL checkpoints                │
│  ├── PiiSession.ts         ← PII redaction sessions          │
│  ├── OtpSession.ts         ← OTP phone sessions              │
│  ├── Notification.ts       ← Notification records            │
│  ├── KvEntry.ts            ← KV store entries                │
│  ├── AuditLog.ts           ← Immutable audit entries         │
│  ├── WebhookInbox.ts       ← Webhook inbox configs           │
│  ├── WebhookMessage.ts     ← Received webhook payloads       │
│  ├── AgentForm.ts          ← Form definitions                │
│  └── FormResponse.ts       ← Form submissions                │
│                                                              │
│  lib/                      ← Shared utilities                │
│  ├── auth.ts               ← API key validation              │
│  ├── auth-user.ts          ← Firebase user resolution        │
│  ├── mongodb.ts            ← Mongoose connection             │
│  ├── firebase.ts           ← Client SDK                     │
│  ├── firebase-admin.ts     ← Admin SDK                      │
│  ├── stripe.ts             ← Stripe helpers                  │
│  ├── pricing.ts            ← Tier config + overage math      │
│  ├── storage.ts            ← S3/B2 file operations           │
│  ├── rate-limit.ts         ← Token bucket implementation     │
│  ├── response.ts           ← Standardized API responses      │
│  ├── analytics.ts          ← Event tracking                  │
│  └── seo-tools.ts          ← Tool metadata for SEO pages     │
│                                                              │
│  mcp/                      ← MCP Server (separate Node app)  │
│  ├── server.mjs            ← Streamable HTTP MCP server      │
│  ├── package.json          ← Standandalone deps              │
│  └── README.md             ← MCP setup guide                 │
│                                                              │
│  scripts/                                                    │
│  └── generate-llms-txt.mjs ← Generates /llms.txt + full     │
│                                                              │
│  docs/                     ← Product documentation            │
│  └── product/                                                │
│      ├── agent-tool-framework.md  ← Tool evaluation criteria │
│      ├── tool-decision-matrix.md  ← Build/drop decisions     │
│      └── otp-limitations.md       ← OTP platform limits      │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Agent** (or MCP client) sends HTTP request with `x-api-key` header
2. **`lib/auth.ts`** validates key → resolves user + tier → checks quota
3. **Route handler** executes tool logic (read/write MongoDB, S3, Twilio, etc.)
4. **`lib/response.ts`** returns standardized JSON response
5. **Usage tracking** atomically increments per-key, per-billing-period counter

### Billing Flow

1. User signs up → Firebase Auth → `User` document created (free tier)
2. Upgrade → Stripe Checkout Session → webhook to `/api/billing/webhook`
3. Webhook handler updates `User.tier` and `subscriptionStatus`
4. All API calls check tier via `lib/pricing.ts` for feature gates and limits

---

## Target Audience

### Primary: AI Agent Developers
- Builders using OpenAI, Anthropic, LangChain, CrewAI, AutoGen, or custom agent frameworks
- Need infrastructure primitives but don't want to manage servers, databases, or third-party accounts
- Typically solo developers or small teams shipping agents quickly

### Secondary: AI Tool Builders
- Companies building agent platforms, agent frameworks, or agent orchestration tools
- Need to offer file handling, error recovery, or HITL as features without building from scratch
- May white-label or embed AgentUtils via the API

### Tertiary: Enterprise AI Teams
- Teams deploying agents in production that need audit logging, PII compliance, and human oversight
- Need SOC-ready immutable logs and approval workflows for regulated industries
- Enterprise tier with custom pricing, unlimited usage, and SLAs

---

## Pricing & Monetization Strategy

### Current Pricing Tiers

| Tier | Price | Calls/mo | Overage | Key Gating |
|------|-------|----------|---------|-----------|
| **Free** | $0 | 500 | Hard cap | No PII Shield, no OTP |
| **Builder** | $19/mo | 10,000 | $0.002/call | All except PII Shield + OTP |
| **Pro** | $49/mo | 100,000 | $0.001/call | All tools unlocked |
| **Enterprise** | Custom | Unlimited | — | Full access, custom limits |

### Revenue Model

- **SaaS subscriptions** — primary revenue via monthly tier subscriptions
- **Usage overage** — metered billing for calls beyond included quota (Builder/Pro)
- **Enterprise contracts** — custom pricing for high-volume or compliance-heavy deployments
- **Self-hosted support** — potential premium for enterprise self-hosting assistance

### Moat & Competitive Advantage

AgentUtils has strong defensibility because its deepest tools require **stateful session round-trips** — two separate API calls that depend on shared server-side state (PII Shield clean→hydrate, Checkpoint pause→resume). This cannot be replicated with a simple library. Additional moats include:

- **Pre-provisioned infrastructure** — phone number pools, SMTP sending domains, public HTTPS endpoints
- **Post-hoc failure capture** — DLQ catches failures after the agent is already dead
- **User-facing output** — Audit Log and Notifications produce results seen by end users, not just developers
- **LLM discoverability** — `/llms.txt` means AI agents find AgentUtils autonomously when developers ask for these tools
- **MCP integration** — native tool integration for Claude, Cursor, and Windsurf

---

## Marketing Angles for Launch

### 1. "The Missing Infrastructure Layer for AI Agents"
Position as essential plumbing — every agent needs these tools, but nobody should have to build them.类比: "Stripe for agent infrastructure."

### 2. "Stop Rebuilding the Same Infrastructure"
Content marketing angle: blog posts, videos, and social content around each tool. Every agent developer has rebuilt file handling, error queues, and PII redaction. Show them they don't have to.

### 3. "One API Key, Not Multiple Vendor Accounts"
Contrast with the alternative: sign up for S3, Twilio, Resend, Upstash, a queuing service, etc. AgentUtils collapses all of that into a single API key.

### 4. "Agents That Find Their Own Tools"
The `/llms.txt` and MCP server are unique differentiators. When a developer tells their AI agent "I need file hosting," the agent discovers AgentUtils and integrates it autonomously. Market this as "agent-native, agent-discoverable."

### 5. "Ship in 60 Seconds"
The landing page already has the 60-second setup flow. Lead with developer experience — curl three commands and you're done. No SDK, no config, no boilerplate.

### 6. "Open Source, Self-Hostable, AGPL-3.0"
Trust signal: the entire platform is open source. Developers can audit the code, self-host for free, or use the managed cloud. This removes vendor lock-in concerns.

### 7. Tool-Specific Content
Each tool is a standalone marketing asset:
- **Dead Letter Queue** — "What happens when your agent crashes? Nothing. Unless you have a DLQ."
- **PII Shield** — "Sending user data to OpenAI? Redact first, restore after. One API call."
- **Human-in-the-Loop** — "Your agent wants to delete production. Should it ask first?"
- **Audit Log** — "Prove to your compliance team what your agent did."

### 8. Developer Community Channels
- GitHub README + stars as social proof
- Hacker News launch ("Show HN: I built the missing infrastructure layer for AI agents")
- Dev.to / Medium technical deep-dives per tool
- AI agent communities (LangChain Discord, AutoGen, CrewAI forums)
- MCP server listing for Claude/Cursor ecosystems

---

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

## 🤖 Agent-First

Designed for AI agents, by AI agents:

- [`/llms.txt`](https://www.agent-utils.com/llms.txt) — LLM-discoverable index
- [`/llms-full.txt`](https://www.agent-utils.com/llms-full.txt) — Full API reference in plain text
- [`/openapi.json`](https://www.agent-utils.com/openapi.json) — OpenAPI 3.0 spec
- [MCP Server](https://github.com/gibtang/agent-utils/tree/master/mcp) — Native tool integration for Claude, Cursor, Windsurf

When a developer asks an AI agent *"I need file hosting for my agent"*, the agent finds AgentUtils and knows exactly how to integrate.

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
- **Styling:** Tailwind CSS 4
- **Database:** MongoDB (Mongoose)
- **Auth:** Firebase
- **Storage:** AWS S3 / Backblaze B2
- **Payments:** Stripe
- **Notifications:** Twilio (SMS), Resend (email)
- **Testing:** Vitest, mongodb-memory-server
- **MCP:** Streamable HTTP transport

## Development

```bash
git clone https://github.com/gibtang/agent-utils.git
cd agent-utils
npm install
cp .env.example .env.local
# Fill in Firebase, MongoDB, Stripe, S3, Twilio, Resend credentials
npm run dev
```

### Available Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run generate:llms` | Regenerate `/llms.txt` and `/llms-full.txt` |

### MCP Server

```bash
cd mcp && npm install && npm start
# Runs on http://localhost:3100/mcp
```

## Contributing

We love contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Good first issues are labeled [`good first issue`](https://github.com/gibtang/agent-utils/labels/good%20first%20issue).

## License

AGPL-3.0 — use freely, contribute back, or use our cloud to skip self-hosting. See [LICENSE](LICENSE).
