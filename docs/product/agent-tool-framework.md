# AgentUtils Product Framework

## Core Thesis

> A good AgentUtils tool solves a problem that requires **persistent state**, **network-accessible infrastructure**, or **pre-provisioned credentials** — none of which an agent has.

Agents are stateless, sandboxed, and credential-less. Every tool in the platform exists because agents hit a wall at one of these three constraints.

---

## The Three Constraints

### 1. Stateless
Agents terminate after each invocation. They cannot:
- Share counters across parallel instances
- Remember anything between calls
- Resume where they left off after a pause
- Accumulate a log over time

**Tools that solve this:** Checkpoint, DLQ, Rate Limiter, Audit Log, PII Shield (session store)

### 2. Sandboxed
Agents run in restricted environments. They cannot:
- Install npm/pip packages
- Open network ports or register public webhook URLs
- Spawn subprocesses (headless browser, ffmpeg, etc.)
- Write to a persistent filesystem

**Tools that solve this:** OTP/SMS (inbound webhook), File Host (persistent storage), Browser Scrape (headless pool)

### 3. Credential-less
Agents have no secure way to hold secrets. They cannot:
- Store API keys safely in prompts
- Access environment variables across deployments
- Authenticate to third-party services without exposing credentials

**Tools that solve this:** Secret Vault, Notify (uses account email), OTP (uses platform Twilio account)

---

## Evaluation Framework

When assessing whether to build a tool, ask:

### 1. Does the problem hit one of the three constraints?
If the agent *could* solve this with an npm install or a local process, the tool has weak justification. If all three constraints are clear, the case is strong.

### 2. Is the state or infrastructure truly shared?
A tool that each agent could replicate independently (e.g., pure compute like JSON repair) is weak. A tool that requires shared infrastructure (rate limit counter, phone number pool, browser pool) is strong.

### 3. Is the design agent-native?
- Single HTTP call — no SDK, no framework
- Structured JSON in/out
- Works from bash, Python, Node, any LLM runtime
- Quota-tracked per API key
- Zero config (platform handles credentials)

### 4. Does the round-trip matter?
Tools with a stateful session round-trip (clean → hydrate, checkpoint → resume, enqueue → dequeue) are hard to replicate because they require the platform to hold state between two separate agent calls. These have the deepest moat.

### 5. What does the competitive landscape look like?
- **No direct competitor** → strong signal to build
- **Competitors exist but require framework buy-in** → build the HTTP-native version
- **Competitors are purpose-built and mature** → don't build, integrate or drop

---

## Why "Just Use npm" Fails

| Scenario | Why It Fails |
|----------|-------------|
| Rate limiting with `bottleneck` | In-process only, resets on cold start, not shared across instances |
| JSON repair with `jsonrepair` | Works fine — this is the exception, not the rule |
| Email with `nodemailer` | Needs SMTP credentials, domain config, no knowledge of user's email |
| Scheduling with `node-cron` | Dies when the agent invocation ends |
| Secrets with `dotenv` | Reads from disk (no disk), not shareable across deployments |
| Headless browser with `puppeteer` | Can't install Chrome in a sandboxed agent context |
| Audit log with `winston` | Writes to local files that don't survive container exit |
| SMS receive with Twilio SDK | Can't open a port or register a public inbound webhook |

---

## Strongest Moat Signals

1. **Stateful session round-trip** — two calls that depend on shared server-side state (PII Shield, Checkpoint)
2. **Pre-provisioned infrastructure** — phone numbers, browser pools, SMTP sending domains (OTP, Notify, Scrape)
3. **User-facing output** — the result is seen by the *user* not the developer (Audit Log, Notify)
4. **Post-hoc capture** — the agent is already dead when this runs (DLQ)
5. **Outbound protection** — protecting the agent from someone else's limits, not protecting your API (Rate Limiter)

---

## Build vs Drop Decision Process

Once a tool idea passes the evaluation framework, apply this tiebreaker process to assign a final verdict:

### Step 1 — Count the constraints
How many of the three constraints (stateless, sandboxed, credential-less) does it hit?
- **3 constraints** → strong build signal
- **2 constraints** → build if round-trip or infrastructure moat exists
- **1 constraint** → likely drop unless no competitor exists at all

### Step 2 — Is there a stateful round-trip?
Does the tool require the platform to hold state between two or more separate agent calls?
- **Yes** → deepest moat, build
- **No** → check Step 3 carefully

### Step 3 — Does a zero-config HTTP competitor exist?
Can a developer solve this with a 2-line npm install or a free API that needs no separate account setup?
- **Yes** → drop (you will lose)
- **No, but framework-specific solutions exist** → build the HTTP-native version
- **No competitor at all** → build

### Step 4 — Is it pure compute?
Does the tool just transform input → output with no state, no shared infrastructure, no credentials?
- **Yes** → drop. It's a library, not a service. Anti-pattern.
- **No** → proceed

### Step 5 — What is the user-facing value?
Who sees the output — the developer debugging, or the end user trusting the agent?
- **End user sees it** → strong build signal (Audit Log, Notify, Agent Form)
- **Developer only** → weaker moat, apply scrutiny

### Quick Reference

| Signal | Verdict |
|--------|---------|
| Stateful round-trip + no competitor | **Build** |
| Post-hoc capture (agent already dead) | **Build** |
| Pre-provisioned infrastructure required | **Build** |
| Pure compute, no state | **Drop** |
| Mature zero-config competitor exists | **Drop** |
| Framework-specific competitor only | **Build** (HTTP-native wins) |
| High infra cost + strong competitor | **Drop** |

---

## Anti-Patterns to Avoid

- **Pure compute tools** — if it's just a function call with no state, it's a library, not a service
- **High infrastructure cost with strong competitors** — browser scraping, video processing
- **Developer tooling framed as agent tooling** — secrets managers, observability platforms
- **Tools that solve shrinking problems** — JSON repair gets less needed as structured outputs improve
