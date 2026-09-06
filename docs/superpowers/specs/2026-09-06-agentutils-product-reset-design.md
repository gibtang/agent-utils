# AgentUtils Product Reset Design

Date: 06-Sep-2026
Status: Approved for implementation on 06-Sep-2026
Decision record: docs/adr/0002 through docs/adr/0027
Domain language: CONTEXT.md

## 1. Outcome

AgentUtils becomes a focused, runtime-independent boundary through which autonomous Agents interact with systems outside their own runtime.

The launch product has three capabilities:

1. Inbox is the first-class product. It gives an Agent a stable destination for external events and preserves those events until they can be processed.
2. State provides exact, versioned JSON coordination between authorised Agents.
3. Files transports private payloads between Agents, people and external systems.

Connections, pairing, billing, notifications, the Agent Owner Dashboard and lifecycle maintenance support those capabilities. Human Workflow, Ledger and all existing standalone utilities are outside the launch boundary.

The rebuild is deliberately breaking. There are no users to migrate, so no legacy API compatibility layer or dual product architecture will be maintained.

## 2. Strategic rationale

The source strategy correctly identifies the durable opportunity: AgentUtils should own infrastructure that must exist independently of any one Agent runtime. It should not compete with improving native scheduling, retries, memory, background execution, browser use or interactive clarification.

The strategy is narrowed in four important ways:

- Inbox leads because a stable public event destination is the clearest runtime-independent need.
- State and Files support Inbox and cross-runtime coordination rather than competing for equal homepage prominence.
- Human Workflow is deferred because ordinary questions and approvals already exist in Codex, Hermes and similar runtimes. A durable external Human Workflow can be reconsidered only when real demand demonstrates a gap.
- Ledger is excluded because the current audit implementation is ordinary expiring logging, not a trustworthy cross-runtime provenance system.

This produces a comprehensible launch rather than a renamed catalogue of unrelated utilities.

## 3. Audience and product language

The buyer is an Agent Owner: a non-developer or semi-technical professional who connects and oversees autonomous Agents. Product copy may assume familiarity with products such as Codex, Hermes, Stripe or GitHub, but must not assume the owner understands API keys, webhook signatures, HMAC, leases or HTTP status codes.

The Agent is the primary operational user. MCP is its default interface. The owner describes the outcome and the Agent creates resources, configures workflows and explains any required external-service steps.

The dashboard is the owner's oversight and recovery surface. It is not presented as a developer console.

Canonical terminology is defined in CONTEXT.md. Legacy names such as Checkpoint, Confession, DLQ, KV Store, Audit Log and Image Upload must not appear as current product concepts.

## 4. Scope

### 4.1 Included at launch

- Google sign-in through Firebase
- Agent Connections
- Short-lived Pairing Codes
- One remote Streamable HTTP MCP service
- One versioned HTTP API under /v1
- Long-lived named Inboxes
- Universal inbound HTTP requests
- Stripe and GitHub inbound source verification
- Coolify inbound event guidance, explicitly labelled Unverified
- Immutable Events
- Expiring Event Claims and at-least-once processing
- Versioned JSON State Records with compare-and-set
- Private Files, direct uploads and temporary Sharing Links
- Same-owner, named-Agent resource sharing
- Agent Owner Dashboard
- Actionable email notifications
- Stripe Checkout, subscription webhooks and billing portal
- Plan limits, retention, expiry, Trash and permanent deletion
- Coolify deployment and scheduled maintenance
- Generated API, MCP and machine-readable documentation
- Public marketing, integration, runtime, pricing, documentation and legal pages

### 4.2 Excluded at launch

- Human requests, approvals, forms, secrets and review queues
- Checkpoint and Confession
- Ledger or customer-facing audit product
- Generic scheduler or delayed event delivery
- Generic DLQ or replay product
- Runtime wake-up guarantees
- WebSocket or SSE subscriptions
- State locks, counters, JSON Patch, subscriptions or full history
- Semantic or vector memory
- Cross-account sharing
- Permanent public file URLs
- Arbitrary URL fetching
- OAuth access to Stripe, GitHub or Coolify accounts
- Two-way integration syncing or actions in source systems
- Annual billing, overages, Enterprise contracts or usage-based billing
- Vercel integration
- Generic screenshot, URL-reader, PDF-conversion, JSON-cleaning or browser products
- OTP interception, temporary phone numbers or autonomous payment cards

## 5. Delivery approach and system boundary

The product layer is rebuilt cleanly in the existing repository. Work proceeds through tested vertical slices, but all slices target one coherent launch.

The following foundation remains:

- Next.js and TypeScript
- Firebase Google authentication
- MongoDB through Mongoose
- Backblaze B2 through its S3-compatible API
- Docker packaging
- Coolify deployment

Stripe billing is implemented as a new launch dependency.

The application is divided into modules with explicit service boundaries:

- Identity and Connections
- Inbox
- State
- Files
- Billing and entitlements
- Activity and notifications
- Retention and deletion
- Owner Dashboard
- MCP and HTTP adapters
- Public website and generated documentation

MCP tools, HTTP routes and dashboard server actions must call the same application services. They must not contain independent copies of permission, validation, lifecycle or billing rules.

## 6. Core domain model

### 6.1 Owner Account

The account controlled by one authenticated Agent Owner. It owns billing, plan entitlements, Agents and all resources created by those Agents.

### 6.2 Agent

A logical autonomous participant named by the owner. An Agent survives replacement or rotation of its Connection credential.

### 6.3 Connection

A revocable authorisation for one Agent to use standard Inbox, State and Files capabilities. Connection credentials are scoped to one owner and one Agent.

### 6.4 Pairing Code

A single-use code that expires 10 minutes after creation. The stored value is a cryptographic hash. Redeeming it creates one Connection credential; the plaintext credential is returned only to the Agent.

### 6.5 Inbox

A long-lived named destination for one external source or workflow. It has a stable receiving address and is assigned to one Agent by default. The owner may share or reassign it without changing that address.

### 6.6 Event

An immutable occurrence accepted by an Inbox. The Event records:

- Stable AgentUtils Event ID
- Inbox and owner
- Original request body
- Allowlisted headers
- Received time
- Source type
- Verified or Unverified status
- Provider event ID when present
- Derived provider-specific view
- Processing state and timestamps
- Retention expiry

The original body is the source of truth. Derived views and processing records cannot rewrite it.

### 6.7 Claim

A temporary exclusive right to process one Event. Launch uses a fixed five-minute lease. An active lease prevents another Agent from claiming the Event. If the lease expires, the Event becomes available again. A completion submitted with an expired or replaced Claim fails with a conflict.

### 6.8 State Record

One named JSON value owned by an Agent. It has a monotonically increasing version, optional expiry, timestamps and explicit named-Agent grants. A single record is limited to 64 KB. Total State storage is controlled by the plan.

### 6.9 File

A private binary object with metadata, checksum, size, content type, owner, creating Agent, access grants and expiry. File states are Pending Upload, Available, Deleted and Expired.

### 6.10 Sharing Link

A random, short-lived, revocable capability for downloading one File. It can be one-time or limited to a configured number of downloads. It never grants access to State or other resources.

### 6.11 Subscription and Usage Window

The local projection of Stripe subscription state and plan entitlements. It contains no payment-card data. Usage counters are atomic and tied to a monthly usage window.

### 6.12 Activity Record

An internal operational and security record used for the dashboard, support and owner notifications. It is not marketed as Ledger, provenance or a tamper-evident audit system.

## 7. Identity, onboarding and permissions

### 7.1 Owner onboarding

The owner-facing journey has three stages:

1. Continue with Google.
2. Tell an Agent: Connect to AgentUtils using code ABCD-EFGH.
3. Complete one runtime-required instruction if necessary, then see the confirmed Connection.

The Agent handles MCP configuration. Some runtimes, including current Codex clients, require a restart before a newly added MCP server becomes available. The product states this plainly and does not promise universal instant setup.

Every runtime uses the same AgentUtils MCP address. Runtime-specific pages explain only the configuration differences.

### 7.2 Credential handling

- Pairing Codes and Connection credentials are generated from cryptographically secure random values.
- Only hashes are stored.
- Plaintext Connection credentials are disclosed once to the connecting Agent.
- Credentials are never placed in URLs, application logs, analytics or owner-facing copy.
- The normal dashboard does not display reusable API keys.
- Advanced HTTP access uses the same scoped Connection identity, not a separate account-wide master key.
- Revocation takes effect immediately.

### 7.3 Permission boundary

An owner can inspect, manage, recover and permanently delete all resources in the account; revoke Connections; override same-account grants; manage billing; and delete the account.

An Agent can create and manage its own Inboxes, State and Files. It can share State or Files only with another Agent connected to the same owner. The creating Agent can revoke grants it created.

An Inbox receiving address can create Events only in that Inbox. It cannot read data.

A Sharing Link can download only its File and only while its expiry and download allowance remain valid.

Cross-account Agent sharing and public State links are forbidden.

## 8. Inbox design

### 8.1 Creation

Inbox creation is Agent-led. The owner describes the desired result, the Agent creates and names the Inbox through MCP, selects a source mode and explains the external setup. The dashboard provides a guided fallback.

Inboxes are long-lived by default. Disposable per-task Inboxes are deferred.

### 8.2 Receiving addresses

Each Inbox receives a stable, high-entropy HTTPS address. Deleting an Inbox disables acceptance immediately. Restoring it during the seven-day Trash window restores the same receiving address. Permanent deletion retires that address permanently.

### 8.3 Source modes

- Universal Unverified accepts an HTTP request at the private receiving address and labels every accepted Event Unverified.
- Generic HMAC verifies a configured signature over the raw body and labels a valid request Verified.
- Stripe verifies the Stripe signature against the raw body and the configured endpoint secret.
- GitHub verifies the GitHub signature against the raw body and configured secret.
- Coolify accepts its documented JSON webhook notifications but labels them Unverified because Coolify does not send a signature or shared-secret header.

Verification secrets are encrypted at rest, redacted from logs and never returned after creation. Failed verification is rejected and does not create an Event.

### 8.4 Event acceptance

- Maximum request body is 1 MB.
- Only a strict header allowlist is retained.
- Cookies, Authorization and unrelated infrastructure headers are discarded.
- The server validates the source before parsing provider-specific content.
- Durable persistence happens before a successful response is returned.
- Accepted requests return promptly; Agent processing is asynchronous.
- A failed signature returns an authentication error.
- An oversized body returns HTTP 413.
- An exhausted monthly Event allowance returns HTTP 429 with a clear machine-readable reason.
- Malformed provider payloads return a validation error and are not counted.

Provider event IDs form an idempotency key within one Inbox. Universal sources may supply an AgentUtils idempotency header. Repeated delivery returns the original Event identity without consuming another Event allowance.

### 8.5 Processing

The visible lifecycle is:

Received to Processing to Completed.

An Agent can check an Inbox or wait for an Event through MCP. The wait operation is bounded and does not promise to start a disconnected runtime. One active Claim may exist per Event. Completion requires the current Claim.

The service guarantees recoverable at-least-once availability. It does not guarantee exactly-once external side effects.

### 8.6 Retention

Event history is retained from its received time:

- Free: 7 days
- Plus: 30 days
- Pro: 90 days

Completed and unprocessed Events use the same retention rule. The dashboard shows the expiry. Upgrading extends Events that have not yet expired. Expired Events cannot be restored.

## 9. State design

Launch State tools support:

- Store a named JSON value
- Retrieve one value
- List records and metadata
- Delete a record
- Set or change an optional expiry
- Update only when the expected version matches

New records begin at version 1. Successful updates increment the version atomically. A version mismatch returns the current version and a conflict error without modifying data.

State remains private to its creating Agent and owner until explicitly shared with a named Agent under the same owner. There is no account-wide shared namespace.

State persists until deleted or expired and counts against the plan's State storage limit. At the limit, reads and deletes continue but writes that increase storage fail.

## 10. Files design

### 10.1 Intake

Files enter through:

- An upload initiated by an authorised Agent
- A short-lived upload link created for a person or external service
- File content included in an Inbox request when it fits within the Inbox body limit

AgentUtils does not fetch arbitrary URLs.

Uploads use short-lived, narrowly scoped B2 upload authorisation so large bytes do not pass through the Next.js application. An upload must be finalised before the File becomes Available. Finalisation validates size, content type and checksum.

### 10.2 Limits

Maximum individual File size:

- Free: 100 MB
- Plus: 1 GB
- Pro: 1 GB

Maximum active File storage:

- Free: 100 MB
- Plus: 5 GB
- Pro: 25 GB

Maximum File lifetime from creation:

- Free: 24 hours
- Plus: 7 days
- Pro: 30 days

### 10.3 Access

Files are private to the creating Agent and owner. They may be shared with named Agents under the same owner. Inbox-associated Files inherit the Inbox access boundary.

External recipients use Sharing Links. Links are short-lived, revocable and optionally constrained to one or a maximum number of downloads. A download checks File status, expiry, link expiry and remaining allowance before issuing a very short-lived B2 download authorisation.

B2 objects are never permanently public. Deleting or expiring a File invalidates all access immediately and schedules physical object removal.

## 11. Billing, plans and entitlement behavior

Stripe Checkout creates Plus and Pro subscriptions. Stripe webhooks are the authority for subscription lifecycle changes; the billing portal handles payment methods, invoices, plan changes and cancellation. Webhook processing is signature-verified and idempotent.

### 11.1 Launch plans

| Plan | Monthly price | Connections | Inboxes | Events per month | Active File storage | State storage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Free | US$0 | 1 | 2 | 500 | 100 MB | 1 MB |
| Plus | US$19 | 3 | 10 | 10,000 | 5 GB | 25 MB |
| Pro | US$49 | 10 | 50 | 100,000 | 25 GB | 100 MB |

API calls and MCP tool calls are not billable units. There are no overages.

Paid usage windows follow the Stripe billing period. Free usage resets monthly in UTC. Usage updates are atomic. The owner is warned at 80 percent and 100 percent.

At a hard limit:

- New resources covered by a count limit cannot be created.
- New Events are rejected when the Event allowance is exhausted.
- State writes that increase storage are rejected; reads and deletes continue.
- New File uploads are rejected; existing Files remain readable until expiry.

### 11.2 Downgrades and payment failure

Downgrades use a seven-day grace period. The dashboard asks the owner to choose which Connections and Inboxes remain active if the lower plan limit is exceeded.

If the owner does not choose before the grace period ends, the earliest-created resources within the lower plan allowance remain active and excess newer resources are suspended. Suspended Inboxes stop accepting Events but remain visible.

Existing Events and Files keep their prior expiry during the grace period. After it ends, lower-plan retention is recalculated from original creation time; content already beyond that time expires. State above the lower storage allowance remains readable but cannot be enlarged until usage is reduced or the plan is upgraded.

A past-due paid subscription keeps paid entitlements during Stripe's configured recovery period, capped at seven days. When that period ends without recovery, Free entitlements and the same downgrade rules apply.

## 12. Retention, Trash and deletion

Deleting an Inbox stops event acceptance immediately. Deleted State and Files become inaccessible immediately. Resource deletion places metadata in Trash for seven days. Restore is available during that period.

Account deletion requires explicit owner confirmation and has a seven-day cancellation period. Connection access is revoked and Inboxes stop receiving as soon as deletion begins. Cancelling deletion within seven days restores access.

After seven days, active-system data is permanently removed. Encrypted backups expire through the normal backup cycle within 30 days. Minimal billing records are retained only where legally required and are not reused as product data.

## 13. Activity and notifications

The dashboard contains the complete owner-visible activity record. Email is reserved for:

- A Connection needing attention
- Events repeatedly failing or remaining unprocessed
- Usage reaching 80 percent or 100 percent
- Subscription or payment status changes
- Security-sensitive owner actions

AgentUtils does not email for every Event. Email is not represented as an Agent wake-up mechanism. Per-Inbox notification preferences are deferred.

Activity records must avoid request bodies, State values, File content and secrets. They record actor, action, resource identity, result, time and a safe reason code.

Operational Activity Records are retained for 90 days on every plan. Event bodies, State values and File content continue to follow their own shorter or longer retention rules; an Activity Record may retain only safe metadata after its related resource expires. Billing records follow the deletion policy and legal retention requirements.

## 14. Owner Dashboard

The dashboard navigation is:

- Overview
- Agents
- Inboxes
- Data
- Usage & Billing
- Settings

Overview shows Connection health, recent activity, current usage and items requiring attention.

Agents shows logical Agents, Connection status, pairing, last activity and revocation.

Inboxes shows source, verification status, receiving health, Event status, expiry and recovery controls.

Data groups State and Files. The owner can inspect metadata and safe content, manage grants, revoke links, delete and restore. Raw operational editing is not the default experience.

Usage & Billing shows the current plan, exact limits, usage windows, retention, Checkout or upgrade actions and the Stripe billing portal.

Settings contains account, notification, security, Trash and account-deletion controls.

Owner-facing states use Received, Processing, Completed, Needs attention, Unverified, Expiring and Suspended. Developer-oriented error details are available under an advanced disclosure.

## 15. Public website

### 15.1 Positioning

Homepage headline:

Give your AI agent an inbox for the outside world.

Supporting message:

Connect Codex, Hermes or another AI agent so it can receive updates from apps, keep exact shared information and exchange files—even when you are elsewhere.

Primary call to action: Connect my agent.

Secondary call to action: See how it works.

Inbox appears first. State and Files are supporting capabilities. The site does not lead with a generic external control plane, reliability, scheduling, memory, Human Workflow or Ledger.

### 15.2 Information architecture

Primary navigation:

- How it works
- Integrations
- Pricing
- Docs
- Sign in
- Connect my agent

Canonical public pages:

- /
- /how-it-works
- /integrations
- /integrations/stripe
- /integrations/github
- /integrations/coolify
- /integrations/codex
- /integrations/hermes
- /state
- /files
- /pricing
- /docs
- /privacy
- /terms

Runtime pages explain candidly what the runtime already provides, what AgentUtils adds, how configuration works and whether restart or authentication steps are required.

Integration pages describe inbound event reception only. They do not imply OAuth access, account syncing or permission to perform source-system actions. Coolify is visibly labelled Unverified.

### 15.3 Credibility rules

- Remove unsupported numerical claims and vague social proof.
- Do not use production-ready, industry standard, PII redaction, exactly once, instant wake-up or one API key unless literally demonstrated.
- Do not claim an integration is verified without implemented signature validation.
- Show real product screenshots and tested workflows only after they exist.
- Publish plan limits and retention consistently.
- Use the canonical www.agent-utils.com host everywhere.
- Remove references to agentutils.dev.
- Mark dashboard and authentication pages noindex.
- Generate the sitemap from canonical public routes only.

### 15.4 Legacy URL handling

Permanent redirects are used only where the new page is genuinely equivalent:

- KV Store pages redirect to State.
- Image Upload pages redirect to Files.

Checkpoint, Confession, Human-in-the-Loop, DLQ, Scheduler and Audit Log product pages return 410 Gone rather than pretending a different feature is equivalent. The former /tools catalogue redirects to the homepage.

## 16. Interfaces and documentation

MCP is the primary Agent interface. HTTP under /v1 is the advanced interface. Both expose the same application behavior.

Shared runtime schemas define:

- Inputs and outputs
- Validation
- Permission requirements
- Safe error codes
- Plan limits
- Tool annotations
- HTTP response contracts

The following are generated from that source:

- MCP tool definitions and descriptions
- OpenAPI
- API reference tables
- llms.txt
- Typed examples used by docs

Documentation examples run as contract tests. There is no separate v2 brand while routes use /v1.

Tool names are direct and model-readable. The launch surface includes:

- pair_connection
- connection_status
- create_inbox
- list_inboxes
- get_inbox
- check_inbox
- wait_for_event
- claim_event
- release_event
- complete_event
- state_set
- state_get
- state_list
- state_delete
- state_share
- state_revoke
- file_create_upload
- file_complete_upload
- file_get
- file_share_with_agent
- file_revoke_agent
- file_create_link
- file_revoke_link
- file_delete

Owner-only actions are not exposed through ordinary Agent scopes.

## 17. Error contract

Every interface returns a stable error code, a plain-language explanation, whether data was preserved, whether retry is safe and the next action.

Core error categories include:

- authentication_required
- connection_revoked
- permission_denied
- source_verification_failed
- validation_failed
- payload_too_large
- plan_limit_reached
- version_conflict
- claim_conflict
- claim_expired
- resource_deleted
- resource_expired
- not_found
- temporarily_unavailable

Secrets, raw provider bodies and internal stack traces never appear in external errors.

An Agent may release its current Claim early with a safe reason code. The Event returns to Received without changing its immutable content. Repeated Claim expiry or explicit release contributes to the owner-facing Needs attention signal.

## 18. Security requirements

- Every query is scoped by owner and, where applicable, Agent.
- Pairing and capability tokens use sufficient entropy and constant-time verification.
- Connection, Pairing Code and Sharing Link plaintext values are never stored.
- Provider signatures are verified against raw bytes with constant-time comparison where the provider contract permits.
- Verification secrets are encrypted at rest.
- Rate limiting applies by receiving address, Connection, owner and source IP with provider-aware tolerances.
- Security headers and CSRF protection apply to browser sessions and owner mutations.
- Upload file names are metadata only and never used as storage paths.
- Content type is treated as untrusted metadata.
- B2 buckets remain private.
- Analytics contain no Event bodies, State values, file names, secrets or personal message content.
- Billing webhooks and customer-source Stripe webhooks use separate routes, secrets and handlers.
- Account and security actions create safe Activity Records.

## 19. Maintenance and Coolify operations

The Docker image includes a maintenance command. Coolify runs it as an in-container scheduled task every minute. No anonymous or public cross-tenant tick endpoint remains.

The maintenance command:

- Releases expired Claims
- Expires Events and State Records
- Expires Files and Sharing Links
- Physically removes expired B2 objects
- Finalises seven-day Trash deletion
- Applies ended downgrade grace periods
- Queues actionable owner notifications
- Reconciles recoverable Stripe subscription state

Each operation is idempotent and uses atomic conditional updates so overlapping or repeated scheduled executions are safe. Failures are recorded without exposing customer payloads. Operational alerts are sent when consecutive maintenance runs fail.

Coolify stores secrets as runtime environment variables. Secrets are not baked into Docker layers. MongoDB and B2 remain external durable systems; container filesystems are disposable.

## 20. Cleanup requirements

The following public product surfaces are removed:

- Checkpoint
- Confession
- DLQ
- Scheduler
- Audit Log
- KV Store branding
- Image Upload branding
- Human-in-the-Loop review UI
- /tools catalogue
- v2-labelled documentation

The following backend surfaces and models are removed after useful infrastructure has been separated:

- Checkpoint and Confession routes, models and notification jobs
- DLQ routes and models
- Scheduler routes, models and old tick behavior
- Audit Log customer API and model
- Legacy image-only upload and public file-host routes
- Account-wide shared State namespace
- Auto-created, owner-visible plaintext API keys
- Vercel-to-notification relay
- Twilio and OpenRouter code not used by the rebuilt launch

Reusable Firebase, tenant/account, MongoDB, B2, Resend and security helpers may remain only after being renamed, narrowed and covered by the new boundaries.

The README, environment template, legal pages, metadata, robots directives, sitemap, generated schemas and deployment documentation are rewritten to describe the implemented product exactly.

Legal and privacy pages must describe Firebase, MongoDB, Backblaze B2, Stripe, Resend and the Coolify-hosted application accurately. They must disclose the approved retention, deletion and subprocessors without claiming certifications or guarantees that have not been obtained.

## 21. Product measurement

Launch measurement covers the owner activation and paid-conversion funnel:

- Homepage call-to-action selected
- Google sign-in started and completed
- Pairing Code created
- Connection confirmed
- First Inbox created
- First test Event received
- First Event completed
- First State Record stored
- First File finalised
- Checkout started
- Subscription activated

Analytics use opaque account and resource identifiers. They never include Pairing Codes, credentials, receiving addresses, Event bodies, State values, file names, File content, signature secrets or provider payload fields. Operational truth comes from the product database; client analytics are directional and are not used to enforce billing.

## 22. Verification strategy

### 22.1 Domain tests

- Pairing Code single use and 10-minute expiry
- Credential revocation
- Owner and Agent isolation
- Same-owner grant constraints
- Event immutability and idempotency
- One active Claim and five-minute expiry
- Stale Claim completion rejection
- State compare-and-set conflicts
- File link expiry, revocation and download limits
- Plan limits and usage counters
- Retention, Trash and downgrade transitions

### 22.2 Integration tests

- MongoDB persistence and atomic updates
- Private B2 upload, finalisation and download
- Stripe Checkout and billing portal session creation
- Stripe billing webhook signature, replay and out-of-order handling
- Stripe customer Event verification
- GitHub Event verification
- Coolify Event parsing with Unverified status
- Generic HMAC verification
- Coolify maintenance command overlap

### 22.3 Contract tests

- MCP and HTTP produce equivalent results and errors
- Generated OpenAPI and MCP definitions match runtime schemas
- Documentation examples execute successfully
- Legacy routes redirect or return 410 as specified

### 22.4 End-to-end tests

- Google sign-in and Pairing Code creation
- Codex setup including a required restart
- Hermes setup
- Agent-led Inbox creation
- Stripe, GitHub, Coolify and Universal test Event reception
- Event Claim, expiry and completion
- State create, read, share and version conflict
- File upload, share, download, revoke, expire and delete
- Free-to-Plus and Plus-to-Pro upgrades
- Failed payment and downgrade grace period
- Owner recovery from a failed or suspended state
- Responsive and keyboard-accessible dashboard behavior

## 23. Launch acceptance standard

Launch is complete only when a semi-technical owner can, without manually handling an API key:

1. Sign in with Google.
2. Pair Codex or Hermes.
3. Ask the Agent to create an Inbox.
4. Follow plain-language instructions to connect Stripe, GitHub, Coolify or a Universal source.
5. Send and inspect a test Event.
6. Have the Agent claim and complete the Event.
7. Store and retrieve State.
8. Upload, share, download, revoke and expire a File.
9. Upgrade through Stripe and see entitlements update.
10. Understand a failure and recover through the dashboard.

The complete automated suite must pass, the production Docker image must build, the Coolify maintenance task must succeed manually and on schedule, and the public site must contain no legacy or unsupported claim.

## 24. Delivery sequence

1. Capture a deletion manifest and separate reusable infrastructure from legacy product code.
2. Establish shared schemas, domain errors, owner identity, Agent identity, Connections and plan entitlements.
3. Deliver pairing and the remote MCP transport.
4. Deliver Inbox end to end, including source verification, Event lifecycle, dashboard and tests.
5. Deliver State end to end.
6. Deliver Files end to end with private B2 storage.
7. Deliver Stripe billing, usage enforcement, downgrade handling and the billing portal.
8. Deliver Activity, notifications, Trash and Coolify maintenance.
9. Replace the Owner Dashboard.
10. Replace the public website, runtime pages, integration pages and pricing.
11. Generate documentation and machine-readable surfaces from shared schemas.
12. Remove all legacy code, dependencies, claims and routes from the deletion manifest.
13. Run security, accessibility, contract, end-to-end, Docker and Coolify verification.

Each slice includes its model, application service, MCP and HTTP adapters, owner visibility, tests and documentation. A feature is not considered complete when only its route or UI exists.

## 25. Source-informed corrections

The source strategy proposed Human and Ledger as first-class capabilities, Vercel as an example source, compatibility layers for current users and a broad control-plane homepage. The approved design changes those recommendations because:

- Runtime-native Human interaction materially overlaps the proposed launch feature.
- The existing audit implementation cannot support provenance claims.
- There are no users requiring compatibility.
- The owner deploys AgentUtils through Coolify and wants Coolify in the launch workflow.
- A focused Inbox promise is easier for semi-technical owners to understand than an abstract control plane.

Current official platform documentation also establishes two implementation constraints:

- Codex supports Streamable HTTP MCP with bearer or OAuth authentication, but newly added desktop MCP configuration requires a restart.
- Coolify can run recurring commands inside the application container, while its outgoing webhook notifications currently have no signature or shared-secret header.

These constraints are reflected directly in onboarding, deployment and source-verification behavior.
