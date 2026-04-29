# Tool Decision Matrix

Last updated: 2026-04-29 (round 3)

## Decision Key

| Decision | Meaning |
|----------|---------|
| **Build** | Strong moat, no direct competitor, fits the agent constraints framework |
| **Simplify** | Keep but scope down — don't expand, don't compete on features |
| **Drop** | Competitors solve this better; weak moat |
| **Don't build** | Evaluated and rejected — competitor already wins |

---

## Current Tools (in codebase)

| Tool | Decision | Moat | Reason | Best Competitor |
|------|----------|------|--------|-----------------|
| **Checkpoint** | Build | Stateful round-trip, framework-agnostic | Temporal/Inngest require full framework buy-in. Single HTTP call wins. | Inngest, Temporal |
| **Dead Letter Queue** | Build | Post-hoc failure capture | No competitor lets an agent say "I just failed, store this" with no prior setup. | None direct |
| **OTP / SMS Receive** | Build | Pre-provisioned phone pool + inbound webhook | Only agent-native SMS receive API. Competitors are human-facing UIs. Caveat: virtual numbers are blocked by major platforms (WhatsApp, Google, Meta). Addressable use case is ~40% of real-world SMS verification targets. | SMSPool (no API) |
| **PII Shield** | Build | Stateful session round-trip (clean → hydrate) | Round-trip model is unique. Competitors only do detection, not restoration. | Private AI |
| **File Host** | Build | Pre-provisioned B2 + TTL management | Solid. Differentiate on TTL, tier limits, agent-native upload. | Uploadthing |
| **JSON Repair** | Drop | None | jsonrepair npm works fine in most agent runtimes. Structured outputs make malformed JSON rarer. | jsonrepair, structured outputs |
| **Email Notify** | Simplify | Zero-config (knows user's email) | Keep the "no config" angle. Don't expand — Knock/Novu win on multi-channel. | Knock, Novu |

---

## New Tool Ideas (evaluated)

| Tool | Decision | Moat | Reason | Best Competitor |
|------|----------|------|--------|-----------------|
| **Rate Limiter** | Build | Shared counter, outbound framing | Only rate limiter positioned for outbound API protection (not protecting your API). | Upstash Rate Limit |
| **Audit Log** | Build | User-facing accountability layer | No competitor provides user-visible, immutable agent action history. Dev tools (Axiom, Datadog) are not user-facing. | None direct |
| **Webhook Inbox** | Build | Pre-provisioned public HTTPS endpoint, session-scoped | Agents have no public URL. Hard infrastructure blocker, not a convenience gap. No agent-native competitor. | Pipedream, webhook.site (not agent-native) |
| **Key-Value Store** | Build | Simplest interface, API-key scoped, atomic ops | Most frequent agent pain point — statelessness. Enables Rate Limiter counters, agent cursors/flags. Zero-config. | Upstash KV (requires separate account + client) |
| **Agent-to-Human Form** | Build | Hosted UI + webhook routing, stateful round-trip | Agent cannot render UI. Completes HITL story with Checkpoint + Notify. No zero-config competitor. | Typeform, Tally (require account + manual setup) |
| **Token Budget Tracker** | Build | Stateful accumulation across invocations, cross-provider cost normalization | No agent-native competitor. LangSmith is framework-specific. Agent can't count its own tokens across invocations. | LangSmith, Helicone (proxy-based) |
| **Diff & Patch** | Build | Stateful snapshot storage + human-readable review URL | Snapshot must survive across invocations. Pairs with Checkpoint for review-before-apply. No HTTP diff service exists. | GitHub (requires repo) |
| **Idempotency Key Store** | Build | Post-hoc safety across retries/crashes | Agent can't know what it already did after a crash. No general-purpose HTTP idempotency service exists. | Stripe (own API only) |
| **Agent Signing** | Build | Pre-provisioned private key infrastructure | Agent can't self-sign without a key it can't safely hold. Non-repudiable action trail. No competitor in this space. | None direct |
| **Content Moderation Gate** | Don't build | None | Core call is a compute proxy to OpenAI/AWS moderation. Policy config is just a table, not infrastructure. Anti-pattern: pure compute tool. | OpenAI Moderation, AWS Comprehend |
| **Browser Scrape** | Don't build | None | Firecrawl wins by a large margin. High infra cost (browser pool, proxies, anti-bot). Not a tools business. | Firecrawl, Jina Reader |
| **Secret Vault** | Don't build | None | Doppler and Infisical are mature, free at small scale, already in developer stacks. | Doppler, Infisical |
| **Scheduled Wake-Up** | Don't build | None | QStash (Upstash) is exactly this — HTTP scheduling, no SDK, single call, cheap. | QStash |
| **Vision Extract** | Don't build | None | Pure compute proxy — no state, no shared infra. Agents can call vision APIs directly in 1 API call. Anti-pattern: pure compute tool. | OpenAI Vision, Anthropic Claude |
| **Distributed Lock** | Don't build | None | Upstash Redis SET NX is 2 lines of code at $0. KV Store covers the simpler counter use case. Lock semantics are hard to get right generically. | Upstash Redis |

---

## Build Priority Order

Based on moat strength and uniqueness:

1. **Audit Log** — no competitor, user-facing, high trust value
2. **Rate Limiter** — outbound framing is unaddressed, high frequency use case
3. **Webhook Inbox** — hard infrastructure blocker, enables async workflows
4. **Key-Value Store** — highest frequency use case, enables other tools
5. **Agent-to-Human Form** — completes HITL story with Checkpoint + Notify
6. **Token Budget Tracker** — stateful cross-invocation cost tracking, no competitor
7. **Diff & Patch** — snapshot + review workflow, pairs with Checkpoint
8. **Idempotency Key Store** — post-hoc safety, no general-purpose competitor
9. **Agent Signing** — hard credential-less constraint, unique accountability primitive
10. **Checkpoint** (already built — maintain)
11. **DLQ** (already built — maintain)
12. **PII Shield** (already built — maintain)
13. **OTP** (already built — maintain)
14. **File Host** (already built — maintain)

---

## Graveyard

Tools evaluated and rejected. Do not revisit without new evidence.

| Tool | Rejected | Reason |
|------|----------|--------|
| Browser Scrape | 2026-04-29 | Firecrawl wins, high infra cost |
| Secret Vault | 2026-04-29 | Doppler/Infisical win, already in dev stacks |
| Scheduled Wake-Up | 2026-04-29 | QStash wins, identical product |
| JSON Repair | 2026-04-29 | Library solves it, structured outputs shrinking the problem |
| Vision Extract | 2026-04-29 | Pure compute proxy, agents call vision APIs directly in 1 call |
| Distributed Lock | 2026-04-29 | Upstash Redis SET NX solves it at $0; KV Store covers simpler cases |
| Content Moderation Gate | 2026-04-29 | Core call is a compute proxy; policy config is a table not infrastructure |
