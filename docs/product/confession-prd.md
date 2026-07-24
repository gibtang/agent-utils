# PRD: Agent Confession — Cloud-Agent Steering Loop

> **Status:** Draft for review
> **Priority:** P0 — highest-moat tool in roadmap
> **Source:** Cloud-agent pain points (Cursor, OpenAI/Ona, Crabbox)

---

## Problem

Long-running **cloud agents** have no way to ask for help mid-task.

When an agent runs **locally**, it surfaces warnings/errors to a human in real time, and the human steers it. But a **cloud agent** runs unattended for hours or days. If it:
- hits an unexpected state,
- isn't confident about a decision,
- thinks it might be in a loop, or
- needs a judgment call a human would make instinctively…

…it has **nowhere to go**. It either guesses wrong, silently degrades, or burns tokens flailing.

Cursor solved this internally by inventing **"confessions"** — periodic self-reports where the model admits uncertainty, which are shared with the infra team for course-correction. They built custom infrastructure for it because **no API existed**.

This is a wedge: every cloud-agent platform (OpenAI Codex, Cursor, Crabbox) needs this, and they're each building it bespoke.

---

## How Agents Need It

The agent is **alive and running**, but uncertain. It needs:

1. **To report** — "Here's what I'm doing, here's what concerns me."
2. **To wait** — optionally pause until a human responds, or continue and check later.
3. **To receive guidance** — "Do X" / "Abandon Y" / "You're on the right track."
4. **To resume** — pick up the guidance and continue.

This is a **stateful round-trip**: confession → human guidance → agent resumes. The platform holds state between the two calls.

---

## Differentiation from Existing Tools

| Tool | What it does | Why Confession is different |
|---|---|---|
| **Checkpoint** | Pauses agent for *approval* of a specific proposed action | Confession is *proactive* — agent raises concerns, not a pre-formed action for sign-off |
| **DLQ** | Captures failures *after the agent dies* | Confession happens while the agent is *alive and stuck*, before failure |
| **Audit Log** | Records *what happened* (past tense, immutable) | Confession is *forward-looking* — "what should I do next?" |
| **Notify** | One-way push to human ("task complete") | Confession is a *round-trip* — it expects a response back |

---

## Proposed API

### Create a confession

```
POST /v1/confessions
Headers: x-agent-id, x-api-key

{
  "summary": "Refactoring auth module — 60% complete",
  "concerns": [
    "Found 3 different auth patterns in the codebase, unsure which is canonical",
    "Tests for OAuth path are failing but I'm not sure if that's pre-existing"
  ],
  "confidence": 0.4,
  "context": {
    "files_modified": ["auth/index.ts", "auth/oauth.ts"],
    "step": 4,
    "total_steps": 7
  },
  "urgency": "medium",          // low | medium | high | blocking
  "timeout_seconds": 3600,      // optional — auto-resolve if no response
  "timeout_action": "continue"  // continue | abort | escalate_to_dlq
}
```

**Response:**
```json
{
  "data": {
    "id": "conf_abc123",
    "status": "open",
    "created_at": "2026-07-23T10:00:00Z"
  }
}
```

### Poll / fetch guidance

```
GET /v1/confessions/{id}
```

**Response (pending):**
```json
{
  "data": {
    "id": "conf_abc123",
    "status": "open"
  }
}
```

**Response (answered):**
```json
{
  "data": {
    "id": "conf_abc123",
    "status": "resolved",
    "guidance": "Use the JWT pattern from auth/index.ts. OAuth test failures are pre-existing — skip them.",
    "action": "continue",
    "resolved_by": "user_xyz",
    "resolved_at": "2026-07-23T10:15:00Z"
  }
}
```

### Human responds (via web UI or API)

```
POST /v1/confessions/{id}/respond
{
  "guidance": "Use the JWT pattern. Skip OAuth tests.",
  "action": "continue"    // continue | pivot | abort
}
```

### List open confessions

```
GET /v1/confessions?status=open&agent_id=xxx
```

---

## Moat Analysis (per AgentUtils framework)

| Signal | Verdict |
|---|---|
| **Stateful round-trip** | ✅ — confess → respond → resume (deepest moat) |
| **Post-hoc capture** | ❌ — agent is alive, not dead |
| **Pre-provisioned infrastructure** | ✅ — needs hosted web UI for humans to respond |
| **Constraints hit** | All 3: stateless (state between calls), sandboxed (can't render UI), credential-less (no way to reach human) |
| **Competitor** | None — Cursor built bespoke; no HTTP-native API exists |

**Score: BUILD — highest priority.**

---

## Key Design Decisions

1. **Non-blocking by default** — agent can continue working after confessing and poll later. `blocking: true` option pauses like Checkpoint.
2. **Human UI** — like Checkpoint's approval page, a hosted web page at `/c/{id}` where humans see the confession and respond. This is the "agent can't render UI" constraint.
3. **Urgency routing** — `blocking` confessions could trigger Notify (email/push) to the human. Non-blocking ones queue for next review.
4. **Webhook callback** — optional `callback_url` so the agent gets POSTed when guidance arrives (don't have to poll).

---

## Build Plan

1. **Mongoose model** — `Confession` (id, agentId, tenantId, summary, concerns[], confidence, context, urgency, status, guidance, action, timestamps)
2. **API routes** — `POST /v1/confessions`, `GET /v1/confessions/{id}`, `GET /v1/confessions`, `POST /v1/confessions/{id}/respond`
3. **Web UI** — `/c/{id}` response page (reuse Checkpoint approval page pattern)
4. **Timeout worker** — cron/tick job to auto-resolve expired confessions
5. **SEO tool page** — `/tools/confession` with metadata in `lib/seo-tools.ts`
6. **MCP tool** — expose as MCP primitive for Claude/Cursor/Windsurf
7. **OpenAPI + llms.txt** — update agent-discovery docs

---

## Pricing

- **Free:** 10 confessions/month
- **Builder:** 1,000/month
- **Pro:** 10,000/month
- **Enterprise:** Unlimited

---

## Marketing Angle

**"Your cloud agent can finally ask for help."**

Cursor built custom "confession" infrastructure because no API existed. Now there's one. One `POST` call, and your agent can report uncertainty, get human guidance, and keep going — from anywhere, on any device.
