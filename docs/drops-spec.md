# Drops MVP build spec

Status: approved product direction, proposed engineering contract. This specifies work to build, not functionality already shipped.

Baseline inspected: `cfdf75ea67cb3d25f67c614acfac2b8e64e99ee5`, October 3, 2026. Revalidate the branch before coding. Route response shapes, safety limits and implementation details below are engineering proposals where the planning session did not decide them.

## 1. Outcome and scope

Add Drops as a domain inside AgentUtils, using the same application/deployment. A paired agent creates a file delivery, uploads directly to private B2, confirms it, and its recipient gets an agent Inbox entry or a human download link. Optional owner approval gates release.

Settled requirements:
- Dogfood-thin, multi-agent from the start, with per-agent connection credentials, scopes and audit.
- Drop is the canonical file unit; do not call it Handoff. Existing Credential Handoff remains unchanged.
- Agent and human recipients. Human access is anyone-with-link, not verified identity.
- Default expiry 72 hours; Pin removes expiry; unpin starts fresh 72 hours.
- Two-step presigned upload plus completion. Private B2, random keys, short-lived GET grants. Never the public file-host route.
- REST only and recipient polling. Optional approval per Drop, Telegram inline approve/deny primary, owner approval page fallback.
- Unanswered approval requests deny and delete after 24 hours, never approve.
- No Drops plan gating during dogfood; add policy hooks. Preserve unrelated existing billing behavior.
- Audit create/approve/deny/retrieve/expire/delete, metadata only, enforced by a writer.
- Operator Inbox, recipient download and approval pages, Connect agent button, display names and paste-ready agent instructions. Clean visual direction like instinct.com without copying its assets.

NOT in MVP: Drops MCP adapter, recipient webhooks, email OTP, Drops plan enforcement, application-layer envelope encryption, cron sweeper. Existing Credential Handoff encryption and existing MCP capabilities are not removed.

## 2. Verified repository map

Source is TypeScript, Next.js 16, React 19 and Mongoose. `package.json` includes Vitest, mongodb-memory-server, AWS S3 client and contract-generation scripts; the AWS presigner dependency is not listed.

| Existing path | Reuse/change |
| --- | --- |
| `app/v1/handoffs/route.ts`; `lib/handoff/{service,operations,schemas}.ts`; `models/Handoff.ts` | Vertical-slice template: transport route, service rules, Zod schemas, contract operations, model. Reuse structure, not credential-specific permissions or crypto. |
| `lib/connections/{service,schemas,operations,auth}.ts`; `models/{Connection,PairingCode,Agent}.ts`; `app/v1/connections/pair/route.ts` | Pairing, identity, authentication, revocation. Add owner-selected scopes throughout. Existing pairing codes are hashed, single-use, 10-minute expiry and atomically consumed. |
| `lib/core/secrets.ts` | `issueSecret`, `hashSecret` (HMAC-SHA256 with pepper), `safeEqualText`; prefixes include `au_conn_`, `au_pair_`, `au_link_`. Hash persistent bearer credentials; never store raw tokens. |
| `lib/contracts/{registry,operation,generate,openapi,docs,errors}.ts`; `scripts/generate-contracts.ts` | Register operations once and generate docs. Registry forbids owner operations from HTTP/MCP mappings; implement owner UI handlers separately rather than weakening that rule. |
| `lib/storage.ts` | Existing B2 S3 helper returns `/api/file-host/{id}`. Add a separate private Drops path; existing upload/get helpers are not safe reuse. |
| `models/Activity.ts`; `lib/handoff/notify.ts` | Activity uses Mixed metadata and a safety comment, not a typed allowlist writer; direct Activity.create calls exist. Add dropId and enforce safe metadata. |
| `app/api/handoffs/**` | Inspect owner-session/account-scoping handler patterns before implementing owner Drops routes. |
| `__tests__/handoff`; `__tests__/connections` | Vitest and database test patterns. |

New work: `models/Drop.ts`, `lib/drops/{service,operations,schemas}.ts`, a safe activity writer, private storage helpers, four v1 route files, owner UI handlers, approval callbacks/pages, onboarding changes and tests. The estimate is not just 8-12 files once UI and scope propagation are counted.

No existing Drop model, Drops route or owner-bound Drops approval workflow was observed. Telegram sending exists in `lib/registration-notifications.ts` and `app/api/vercel-ntfy/route.ts`; it does not establish approval callback security. ADRs 0001-0028 already exist. New ADRs 0029-0033 are scoped Drops exceptions, not replacements for the whole product. Do not repurpose the named source-event Inbox in ADR-0004; GET /v1/inbox below means the Drops delivery list.

## 3. Engineering gates that must not be hidden

- Mongo TTL deletion is not a business-event scheduler: it cannot delete B2 objects or write expiry audit events. Purge only after business cleanup and audit are durable.
- On-read checks deny access but cannot execute a 24-hour timeout on an unread Drop. A reliable durable deadline mechanism is required without a cron sweeper. No suitable deadline worker was verified. Select/test a delayed-job or event-based mechanism before declaring auto-denial/deletion complete. If unavailable, escalate the product tradeoff instead of quietly shipping lazy denial.
- A blanket 72-hour B2 lifecycle rule would delete pinned objects. Lifecycle must spare pins and support fresh expiry after unpin. Verify actual bucket/provider behavior, versions and permissions on staging; this inspection did not access bucket configuration.
- Presigned GET remains usable until expiry; database revoke does not instantly cancel it. A live PUT can recreate staging bytes after deletion. Bound grants, freeze uploaded content into a separate immutable delivery key, and retain cleanup state until upload grants cannot recreate content.
- A submitted checksum or S3 ETag is not proof of SHA-256 integrity. Verify a trusted stored checksum if supported by B2, otherwise calculate from stored bytes in a bounded worker. Direct uploads avoid Next payload limits, not all provider, safety or verification limits.
- Connection redemption currently enforces plan capacity in `lib/connections/service.ts`. No Drops gating does not mean unlimited connected agents. Preserve or seek a separate decision on that global behavior.

These are launch gates, not authorization to introduce deferred webhooks, cron or plan gating. Proposed mechanisms must pass staging tests. Explain any remaining guarantee gap before shipping.

## 4. Model, policy and states

`models/Drop.ts` fields:
- `dropId`: random unique drop_ resource ID.
- `accountId`, `fromAgentId`, `fromConnectionId`: authenticated actor-derived, not client-authoritative.
- `recipient`: `{kind:'agent',agentId}` or `{kind:'human'}`. Proposed MVP safety boundary: active agent in the same account, consistent with ADR-0023. No cross-owner delivery without a new design.
- `filename`: bounded display string, reject paths/control characters, escape output. Never object-key input.
- `b2Key`, `b2Bucket`, optional object version: server-only random storage identifiers.
- `size`, `contentType`, `sha256`, verification state: declared metadata becomes final only after verified upload.
- `status`: uploading, pending_approval, ready, denied, expired, deleted. Separate cleanup state from access state.
- `approval`: required, state (not_required/pending/approved/denied/timed_out), requestedAt, expiresAt, decidedAt, verified owner principal. Store only hashed approval reference, audience/action/account-bound.
- `expiresAt`: delivery deadline; proposed start is successful completion +72h, including approval time. Approval deadline is completion +24h.
- `expiresAtPurge`: omitted for live records; terminal purge time only after audit/cleanup complete. TTL index expireAfterSeconds:0 on this field, not on access expiry.
- `pin`: boolean, null expiresAt while pinned. Never bypass approval timeout or resurrect terminal content.
- `retrievalCount`, `lastRetrievedAt`: atomic successful download-grant issuance counts, not proof bytes were downloaded.
- `humanTokenHash`, `humanLinkExpiresAt`: recipient possession access only, independently revocable and not approval authority.
- `uploadExpiresAt`, `cleanupState`, `cleanupAttempts`, `deletedAt`, timestamps: abandoned upload and deletion-race handling.
- `policyVersion`/future plan policy hook: server-selected, no client-controlled entitlement.

Indexes: unique dropId; account+recipient agent+status+createdAt for cursor listing; sender lookup; token-hash uniqueness where present; deadlines for the selected mechanism; safe terminal TTL. Use compare-and-set state transitions and idempotency. Keep minimal cleanup pointers until bytes are verified absent, then remove row; retain Activity separately. Document terminal purge lag as an engineering setting, not a new recovery window.

Flow: create -> uploading -> verified completion -> ready or pending_approval -> ready on approve; pending -> denied on manual denial/24h timeout; ready -> expired at delivery deadline; authorized owner delete -> deleted. Terminal states never return to ready. Exactly one winning transition and transition audit for competing approve/deny/timeout operations.

## 5. REST contract (proposed wire shapes)

Use existing success/failure envelopes, request IDs, validation and rate-limit patterns. Add exact error codes to the shared catalogue. Cross-account/absent IDs return uniform not-found; scope denial must not leak existence. Dates are ISO strings. Derived actor identity cannot be overridden by JSON/query inputs.

### POST /v1/drops

Connection auth + drops:write. Body `{recipient,filename,size,contentType,sha256,requiresApproval?:boolean}`; default approval false. Validate positive size, documented operational max (not plan gating), SHA-256 hex and bounded metadata.

Return standard envelope containing `{dropId,status:'uploading',upload:{method:'PUT',url,headers,expiresAt}}`. Proposed PUT lifetime 5 minutes, exact random private staging key and signed required headers. No download grant or recipient-visible Inbox entry. Accept a bounded idempotency key so retries do not mint duplicate Drops. All staging upload grants expire even when the eventual Drop is pinned.

### POST /v1/drops/{id}/complete

Connection auth + drops:write + sender ownership. Accept no arbitrary storage key. Verify existence, size, type and trusted checksum, freeze content into a different immutable delivery key to prevent a still-valid PUT mutating the released file. If asynchronous verification is needed, remain uploading with a retryable state until it passes.

Return `{dropId,status,expiresAt,approvalExpiresAt?,humanLink?}` without B2 internals. Start clocks once; duplicate complete neither extends them nor sends repeated Telegram requests. Ready is recipient-visible; pending_approval is owner/sender metadata only. A human link for a pending Drop shows pending, never bytes.

### GET /v1/inbox

Connection auth + drops:read. Derive account and recipient agent from caller. Cursor-paginated ready/non-expired items `{items:[{dropId,filename,size,contentType,sha256,fromAgentId,createdAt,expiresAt,pin}],nextCursor}`. Exclude uploading/pending/terminal Drops. Stable cursor order, bounded page size, validated cursor. No storage keys, link tokens or credentials. Multiple connections for one agent see its deliveries only when their own scopes permit it.

### GET /v1/drops/{id}

Connection auth + drops:read + addressed recipient agent. Sender status access must be separate metadata-only behavior, not accidental recipient download rights. Check scopes, account/agent/connection status, approval, expiry and object availability before every grant.

Return `{dropId,download:{url,expiresAt},filename,size,contentType,sha256}`. Proposed GET life 60 seconds or remaining delivery/link life, whichever is shorter. Safe attachment disposition, no active-content inline rendering. Atomically increment retrievalCount and audit each successful grant; no increment on rejected access.

Human handler: separate hashed possession-token lookup, same release policy. Explicit Download action mints GET; previews/page loads do not retrieve or consume a link. Human identity remains unverified and forwarding is possible. Use no-referrer, no-store, token redaction, rate limits, no third-party analytics and safe content disposition.

Owner handlers: authenticated list/approve/deny/pin/unpin/delete under an internal UI route such as /api/drops, patterned after app/api/handoffs. No connection/MCP authority. Account-bind session, CSRF-protect state-changing cookie requests. Proposed Pin authority is owner-only: live verified Drop only, no resurrection and no approval override. Unpin sets now+72h and updates storage/deadline state through a recoverable transition.

Add explicit route files: `app/v1/drops/route.ts`, `app/v1/drops/[id]/complete/route.ts`, `app/v1/inbox/route.ts`, `app/v1/drops/[id]/route.ts`.

## 6. Scopes, onboarding and generated docs

Add owner-selected allowlisted scopes to PairingCode and Connection: drops:write, drops:read. Pairing creation binds requested scopes; redemption copies them exactly and cannot escalate. Include safe scope metadata in status/view and authenticated actor/operation context. Enforce a shared requireScope in the service boundary, not only routes/UI. Old connections have no Drops rights until owner-authorized selection; preserve existing non-Drops rights and revocation behavior.

Connect agent flow: create/select named agent -> choose scopes -> mint expiring code -> copy instruction block -> see connected status -> revoke anytime. Separate named agents/codes for each bot. One returned credential goes into the runtime secret store, never prompts, git, logs or UI persistence.

Register operations in `lib/drops/operations.ts`; import them in `lib/contracts/generate.ts`, alongside existing connections/handoff imports. No mcp fields for Drops. Check generator support for {id} path parameters: Handoff uses IDs in POST bodies, so correct new path schemas must be tested, not assumed. Regenerate/commit `public/openapi.json` and `public/llms.txt` when implementing and run `npm run check:contracts`. Registry registration alone does not publish docs; generation and deployment are required.

Paste-ready instruction block (BASE_URL supplied by operator; pairing code supplied separately; these are target MVP instructions, not current live endpoints):

```text
Your utilities live at <BASE_URL>. Read /llms.txt and /openapi.json first.
Pair once: POST /v1/connections/pair with {"code":"<temporary pairing code>","runtimeVersion":"<runtime label>"}.
Store the returned credential in your runtime secret store, never prompts, files, logs or messages.
Use Authorization: Bearer <credential>. Check /v1/connections/status for identity and scopes.
Send: POST /v1/drops with recipient, filename, size, contentType, sha256, and requiresApproval if needed.
PUT bytes to upload.url with exactly upload.headers, then POST /v1/drops/{dropId}/complete.
Do not announce delivery until completion returns ready; pending_approval means wait for the owner.
Receive: poll GET /v1/inbox, then GET /v1/drops/{dropId} for a short-lived download grant.
Use requiresApproval:true when owner approval is needed; never bypass the gate.
Drops expire 72h after completion unless owner-pinned; unanswered approvals deny at 24h.
Respect retry delays and never expose credentials, signed URLs or private contents to other recipients.
```

Add runnable curl examples for pair/create/PUT/complete/inbox/get to generated docs, with environment variables for credentials, exact envelope extraction and signed-header handling. No real secrets in fixtures/examples. Keep Credential Handoff teaching separate and intact.

## 7. Private storage and cleanup

Add clearly separate Drops helpers in lib/storage.ts or a private submodule it exports: mint PUT, HEAD/checksum verification, immutable finalization, GET presigning, protected/expiring storage copy/move, version-aware deletion and deletion verification. Add presigner dependency and HEAD/COPY primitives. Private Drops config must never fall back to public bucket credentials. Least-privilege B2 keys, private ACL, tested CORS/headers. Do not return file-host URLs for Drops.

Proposed lifecycle strategy to validate: staging, expiring and pinned namespaces/storage classes; lifecycle cleans abandoned staging and safely bounded expiring content, while pinned content has no age-delete policy. Pin/unpin may require copy/move with updated creation/deadline semantics; verify new object before deleting old versions. No rule may delete before effective expiry; do not assume B2 lifecycle reads Mongo dates or arbitrary metadata.

Logical denial/delete immediately blocks new grants, erases recipient/approval references, cancels deadlines and attempts byte deletion. Failure retains durable minimal cleanup state and retries via the selected event mechanism. Include follow-up after outstanding PUT expiry. Physical deletion is complete only after relevant versions are absent and no upload grant can recreate deliverable content. Do not TTL away the only cleanup pointer. On-read checks are defense in depth, not the deadline engine.

Before dogfood, prove on staging: anonymous B2 GET denial, PUT/GET signing, checksum integrity, immutable completion, lifecycle-safe Pin/unpin, orphan/version cleanup and durable deadline delivery. Document actual provider deletion lag, backup behavior, operational file cap and signed-URL revocation window. Unknown infrastructure is a launch blocker.

## 8. Approval security

Use v1 Account/Connection patterns, not legacy v2 Checkpoint/tenant plaintext keys. Issue au_link_-style high-entropy references with hashes stored; possession alone is not owner identity. Recipient link tokens and approval tokens are separate audiences.

At verified completion, send one metadata-only Telegram approval message to the owner's verified/bound chat/user identity. Show filename, size, sender and intended recipient, no contents or download grants. Authenticate inbound bot webhook; bind callback principal to account. Use short opaque single-use references bound to drop/action/account/deadline. Forwarded, expired, cross-owner and replayed callbacks cannot approve.

Fallback page requires owner authentication, shows full release summary and POST decision; GET never changes state. Compare-and-set decision invalidates both controls. Notification failure never bypasses gate; show attention state and retain timeout work. After 24h release policy denies regardless of execution lag, while durable deadline work records denial and deletes bytes. Pending pins still time out. Never silently default-approve.

## 9. Audit writer

New `lib/drops/activity.ts` or shared `lib/core/activity.ts`: discriminated event union, fixed metadata schemas, no arbitrary passthrough. Events drop.create, drop.approve, drop.deny (manual/timeout), drop.retrieve, drop.expire, drop.delete. Add dropId to Activity without overloading handoffId.

Allow bounded filename, verified size, agent IDs, timestamps, recipient kind, reason code and request ID only as needed. Never file contents, prompts, raw bodies, credentials, token hashes, tokens, approval refs, signed URLs, ciphertext or arbitrary headers. Keep sha256 in Drop integrity data, not automatically audit. Human retrieval is possession-link access, not verified person identity.

Reject unknown keys recursively at writer boundary. All Drops writes use writer. Before claiming global Activity safety, inventory/migrate direct Activity.create calls (including lib/handoff/notify.ts) to typed schemas preserving safe existing events. Mixed metadata and a comment are not enforcement. Redaction tests cover logs, notifications and cleanup failure records; retain minimal identifiers/reason codes, not payload dumps.

## 10. UI and implementation order

Operator Inbox: incoming/outgoing, sender/recipient names, filename/size, approval state, expiry countdown, Pin/unpin/Delete, connections/revoke; loading/error/empty states. Human page: pending/denied/expired/deleted states, metadata and explicit Download only when ready, no active HTML/SVG preview. Approval page: authenticated owner, full summary, approve/deny, replay-safe result. Connect agent: distinct names, scopes, expiring code, instructions and status, never persistent credential display.

Visually inspect mobile/desktop renders: contrast, whitespace, long filenames, focus/keyboard, missing labels and every terminal state. DOM-only verification is insufficient.

Implementation order:
1. Models/schemas, scope propagation, typed audit writer and tests; keep unrelated domains working.
2. Private staging/finalization/checksums; resolve lifecycle Pin and reliable deadline gates.
3. Create/complete/inbox/get, owner services, atomic transitions, idempotency and cleanup.
4. Owner-bound Telegram callbacks plus fallback approval page.
5. Onboarding, REST docs/examples and generation without Drops MCP registration.
6. UI/screenshots, staging integration proof, end-to-end owner journey, same-app deployment.

## 11. Acceptance criteria and tests

Use Vitest + mongodb-memory-server, fake clocks, mock storage/deadline adapters for deterministic unit/integration cases, plus staging B2 tests. Mocks do not prove bucket policy/checksum/lifecycle.

- Single-use/expired pairing rejection; scopes copied exactly, redeemer cannot escalate, read-only/write-only denial, old connections no Drops rights, revoke blocks future grants. Existing capabilities unchanged.
- A sends to B in one account; only B gets Inbox/download. Third agent and other account cannot enumerate, complete or retrieve; sender cannot complete another upload. Human token cannot call owner/agent endpoints.
- Nothing recipient-visible before verified completion. Missing/oversize/type/digest mismatch fails safely. Sender-declared checksum and mutable staging overwrite cannot bypass verification. Duplicate complete does not reset clocks/notifications.
- Access ends completion+72h. GET never outlives remaining deadline. Pending approval denies at +24h without reads; deadline work writes denial and completes cleanup. Silence never releases content.
- Concurrent approve/deny/timeout yields one winning state/audit. Replay/forwarded/cross-owner Telegram callbacks fail; fallback works on notification failure. Pin never bypasses approval.
- Pin preserves bytes through lifecycle age; unpin grants fresh 72h. Terminal objects cannot resurrect. Partial copy/deadline transitions recover.
- Deny/delete blocks new grants immediately, retains cleanup on failure, handles live PUT race, removes relevant versions and only then schedules row purge. Audit survives row removal. Existing GET validity window is bounded/documented, not instantly revocable.
- Successful grant increments retrievalCount once and audit once; rejection/preview does not. No secret/body/signed URL in Activity/log/Telegram/cleanup; writer rejects unexpected metadata keys.
- Anonymous B2 GET fails; public file-host cannot retrieve Drop keys. Existing file-host and Credential Handoff regression tests pass.
- Stable bounded pagination, identity not overridden by body/query, safe filenames, no-store/no-referrer, attachment disposition/XSS covered.
- `npm test`, `npm run lint`, `npm run build`, `npm run check:contracts` pass. Schemas/errors/envelopes/path parameters and examples match implementation. Existing MCP tools remain; Drops MCP tools absent.
- No Drops plan gating introduced. Existing connection capacity errors documented and tested. Operational size/rate safety controls are not plan limits.
- Mobile/desktop screenshots inspected. End-to-end demo pairs named A/B, uploads, approves, receives, pins/unpins, times out and deletes with verified B2 effects.

Do not call done while private-bucket policy, checksum integrity, durable deadlines, lifecycle-safe Pin or byte deletion remain unverified. Bring back the missing guarantee and options instead of weakening requirements unnoticed.

## 12. Evidence and limits

Verified from a git clone at the baseline: paths, model fields, hashing functions, pairing lifetime/atomic redemption, registry owner restrictions/generation imports, public storage helper return, test dependencies and ADRs 0001-0028. This is code inspection, not production runtime verification.

Not verified: deployed Coolify settings, live hostname behavior, B2 privacy/lifecycle/CORS/version configuration, bucket checksum support, owner Telegram binding, delayed-job reliability, deletion latency or existing UI completeness. These need source-of-truth checks and staging tests. Deployment and visual direction are requirements, not findings from this inspection.

AgentFiles wording in ADR-0030 records session positioning, not a fresh competitor audit. This documentation commit implements no feature and changes no production settings.
