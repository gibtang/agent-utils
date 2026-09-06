# AgentUtils

AgentUtils is a runtime-independent boundary through which autonomous agents exchange events, coordination data, files, and human decisions with systems outside their own runtime.

## Language

**Agent Owner**:
A non-developer or semi-technical professional who connects and oversees one or more autonomous agents.
_Avoid_: Developer, API user, operator

**Agent Owner Dashboard**:
The oversight and recovery surface where an Agent Owner sees connected Agents, Inbox activity, State, Files, usage, billing, and anything requiring attention. Agents normally create operational resources through MCP; this dashboard provides visibility, control, and guided fallbacks.
_Avoid_: Developer console, API dashboard, admin panel

**Agent**:
An autonomous software participant authorised by an Agent Owner to use AgentUtils capabilities.
_Avoid_: Bot, client application

**Connection**:
An Agent Owner's authorisation for one Agent to access a defined set of AgentUtils capabilities.
_Avoid_: API key, integration, MCP server

**Pairing Code**:
A short-lived, single-use code through which an Agent claims a Connection that its Agent Owner has initiated.
_Avoid_: API key, access token, OAuth code

**Inbox**:
A long-lived, named destination assigned to one Agent that receives Events from one external source or workflow for an Agent Owner.
_Avoid_: Webhook endpoint, webhook receiver

**Event**:
One immutable occurrence received by an Inbox and made available for authorised processing.
_Avoid_: Webhook, message, payload

**Event View**:
A readable, provider-specific presentation derived from an Event. It is never the source of truth and does not replace the original request body.
_Avoid_: Event summary, transformed Event

**Verified Source**:
An external sender whose request AgentUtils authenticated using an explicitly configured verification method.
_Avoid_: Trusted payload, claimed source

**Unverified Source**:
An external sender that reached an Inbox without cryptographic source authentication.
_Avoid_: Anonymous source, trusted source

**Inbound Integration**:
A guided way to configure an external service to send Events to an Inbox. It does not imply account access, two-way synchronisation, or permission to act in that service.
_Avoid_: Connector, sync, connected account

**Claim**:
An Agent's temporary exclusive right to process one Event; it expires so another attempt can recover abandoned work.
_Avoid_: Lock, ownership, exactly-once delivery

**State**:
Exact structured coordination data owned by one Agent and optionally shared with explicitly authorised Agents.
_Avoid_: Memory, agent memory, KV store

**State Record**:
One named JSON value with an expiry and version used for deterministic coordination.
_Avoid_: Memory entry, document, cache entry

**File**:
A private transferable payload that can move between AgentUtils workflows, authorised Agents, humans, and external systems.
_Avoid_: Image upload, file host

**Sharing Link**:
A short-lived, revocable capability through which a human or external system can download one File.
_Avoid_: Public URL, permanent link

**Human Workflow**:
A workflow that obtains a decision or input from a person by combining AgentUtils primitives.
_Avoid_: Human primitive, Confession, Checkpoint

**Legacy Utility**:
A previously marketed standalone AgentUtils capability that is outside the rebuilt product boundary.
_Avoid_: Core product, primitive
