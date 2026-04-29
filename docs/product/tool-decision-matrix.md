# Tool Decision Matrix

Last updated: 2026-04-29 (round 2)

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
| **OTP / SMS Receive** | Build | Pre-provisioned phone pool + inbound webhook | Only agent-native SMS receive API. Competitors are human-facing UIs. | SMSPool (no API) |
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
6. **Checkpoint** (already built — maintain)
7. **DLQ** (already built — maintain)
8. **PII Shield** (already built — maintain)
9. **OTP** (already built — maintain)
10. **File Host** (already built — maintain)

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
