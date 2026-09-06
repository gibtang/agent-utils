# AgentUtils Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver private payload transport for Agents, people, and Inbox Events without permanent public URLs or arbitrary URL fetching.

**Architecture:** File metadata and access policy live in MongoDB; bytes live under random Account-scoped keys in a private Backblaze B2 bucket. An Agent creates a pending File and receives a short-lived, object-specific presigned PUT. Completion uses B2 object metadata to validate size, content type, and single-part MD5 before reserving active storage and marking the File available. Authorised reads and Sharing Links issue very short-lived presigned GET URLs.

**Tech Stack:** AWS SDK for JavaScript v3, `@aws-sdk/s3-request-presigner`, Backblaze B2 S3-compatible API, Mongoose, Zod, MCP, Next.js, Vitest.

---

## Task 1: Prove the private B2 presigning contract and replace the storage adapter

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/files/storage.ts`
- Create: `docs/deployment/backblaze-b2.md`
- Create: `__tests__/files/storage.test.ts`
- Create: `__tests__/files/storage.b2.test.ts`

- [ ] Install the official presigner:

```bash
npm install @aws-sdk/s3-request-presigner@^3.1127.0
```

- [ ] Write mocked unit tests for object key generation, presigned PUT expiration, signed content type and `Content-MD5`, `HeadObject`, presigned GET expiration, and idempotent deletion.

- [ ] Implement a single B2 client using the existing endpoint/region/key environment values and force path style only if the current B2 endpoint requires it. Export:

```ts
createUploadAuthorization({ objectKey, contentType, contentMd5Base64, expiresInSeconds }): Promise<{ url: string; headers: Record<string, string> }>;
inspectObject(objectKey): Promise<{ versionId: string; bytes: number; contentType: string; etagMd5Hex: string }>;
listObjectVersions(objectKey): Promise<Array<{ versionId: string; etagMd5Hex: string; bytes: number }>>;
createDownloadAuthorization({ objectKey, versionId, filename, expiresInSeconds }): Promise<string>;
putSmallObject({ objectKey, bytes, contentType, contentMd5Base64 }): Promise<void>;
deleteObjectVersion(objectKey, versionId): Promise<void>;
```

- [ ] Keep the bucket private. Never set object ACLs, public-read, website hosting, or a public base URL.

- [ ] Document a least-privilege B2 application key restricted to the one bucket with read, write, list-version, and permanent version-delete capabilities. Document S3 CORS restricted to `APP_URL`, methods `PUT`, `GET`, and `HEAD`, request headers `content-type` and `content-md5`, exposed response headers `etag` and `x-amz-version-id`, and a 600-second preflight cache. Do not use wildcard origins.

- [ ] Add an opt-in real-B2 test guarded by `B2_INTEGRATION_TEST=1`. It must upload known bytes through the returned presigned PUT, require the signed headers, compare `HeadObject` size/content type/ETag with the known MD5, capture the Version ID, download that exact version through a sixty-second presigned GET, permanently delete that exact version, and verify the configured browser preflight response.

- [ ] After explicit approval to write temporary objects to the configured non-production B2 bucket, run:

```bash
B2_INTEGRATION_TEST=1 npm test -- __tests__/files/storage.b2.test.ts
```

Expected: direct PUT and GET succeed; an altered content type or MD5 fails; an unsigned direct bucket read fails. If external B2 testing is not authorised, leave this gate explicitly unverified in `docs/launch/acceptance.md`; mocked tests are not proof of B2 compatibility. If Backblaze does not enforce `Content-MD5` through the JavaScript v3 presigner, stop this task and switch the implementation to a B2-supported signed checksum before continuing; do not silently drop checksum validation.

- [ ] Run unit tests and commit:

```bash
npm test -- __tests__/files/storage.test.ts
git add package.json package-lock.json lib/files/storage.ts docs/deployment/backblaze-b2.md __tests__/files
git commit -m "feat: add private b2 file authorization"
```

## Task 2: Model Files and Sharing Links

**Files:**

- Create: `models/FileAsset.ts`
- Create: `models/SharingLink.ts`
- Create: `lib/files/schemas.ts`
- Test: `__tests__/files/models.test.ts`

- [ ] Write tests for File statuses `pending_upload`, `available`, `deleted`, `expired`, and `failed`; ownership; same-Account grants; Inbox association; upload deadline; file expiry; byte size; MIME type; MD5; random B2 key; and the exact B2 Version ID selected at completion.

- [ ] Model File grants as named Agent IDs with granted-at metadata. Grantees can inspect and download but cannot reshare, revoke, or delete.

- [ ] Model Sharing Links with `linkId`, File/Account IDs, token hash, display prefix, expiry, optional maximum downloads, atomic download count, revoked time, and timestamps. Never persist the plaintext token.

- [ ] Add indexes for owner/Agent listing, grants, Inbox association, pending upload expiry, File expiry, Trash purge, link hash, link expiry, and active links by File.

- [ ] Restrict filenames to 255 UTF-8 bytes after control-character removal. Preserve the safe original filename in metadata but never use it in the B2 object key.

- [ ] Run `npm test -- __tests__/files/models.test.ts`; expect all schema and index tests to pass.

- [ ] Commit:

```bash
git add models/FileAsset.ts models/SharingLink.ts lib/files/schemas.ts __tests__/files/models.test.ts
git commit -m "feat: model private files and sharing links"
```

## Task 3: Implement direct upload creation and completion

**Files:**

- Create: `lib/files/service.ts`
- Modify: `lib/billing/usage.ts`
- Test: `__tests__/files/upload.test.ts`
- Test: `__tests__/billing/file-usage.test.ts`

- [ ] Write plan-limit tests for individual size: Free 100 MB, Plus/Pro 1 GB. Write active storage tests for Free 100 MB, Plus 5 GB, Pro 25 GB.

- [ ] Define creation input as filename, exact byte size, MIME type, base64 MD5, optional lifetime, and optional `forExternalUploader`. Validate lifetime does not exceed the plan maximum from File creation time.

- [ ] Implement `createFileUpload(actor, input)`:

```text
1. Validate Connection, plan maximum size, lifetime, filename, MIME type, and MD5.
2. Create a random key accounts/<accountId>/<fileId>/<random> with no filename.
3. Persist a pending File with a ten-minute upload deadline.
4. Return a ten-minute presigned PUT URL and its required headers.
```

- [ ] Creating an upload does not reserve active File storage because bytes may never arrive. Limit concurrent pending uploads per Account to twice the plan's Connection count plus five to prevent abuse.

- [ ] Implement `completeFileUpload(actor, fileId)`:

```text
1. Atomically lock an unexpired pending File for completion.
2. Head the exact B2 object.
3. Compare expected and actual bytes, content type, and normalized ETag MD5.
4. Capture the exact B2 Version ID and list all versions under that exact random key.
5. Atomically reserve active File bytes.
6. Mark available with the selected Version ID and set plan-bounded expiresAt.
7. Permanently delete every non-selected version; on mismatch or quota failure, mark failed and permanently delete every version.
```

- [ ] Make completion idempotent: repeating completion for an available File returns the same File; concurrent completion reserves bytes once.

- [ ] Always sign downloads for the stored Version ID. A presigned upload URL can be replayed until it expires, so a later unexpected version must never replace the completed File. The maintenance cleanup lists the random key after upload expiry and permanently removes every version other than the selected one.

- [ ] On expired pending upload or missing object, return `resource_expired` or `validation_failed` with `data_preserved: false` and a next action to create a new upload.

- [ ] Run `npm test -- __tests__/files/upload.test.ts __tests__/billing/file-usage.test.ts`; expect race, mismatch, limit, cleanup, and idempotency tests to pass.

- [ ] Commit:

```bash
git add lib/files/service.ts lib/billing/usage.ts __tests__/files/upload.test.ts __tests__/billing/file-usage.test.ts
git commit -m "feat: add direct private file uploads"
```

## Task 4: Implement authorised reads and same-Account Agent grants

**Files:**

- Create: `lib/files/presenter.ts`
- Modify: `lib/files/service.ts`
- Create: `app/api/files/route.ts`
- Create: `app/api/files/[fileId]/route.ts`
- Create: `app/api/files/[fileId]/access/route.ts`
- Test: `__tests__/files/access.test.ts`
- Test: `__tests__/files/owner-routes.test.ts`

- [ ] Write tests for private default, owner Agent read, granted Agent read, ungranted same-Account denial, cross-Account denial, revoked grant, unavailable File, expired File, and deleted File.

- [ ] Implement `getFile(actor, fileId)` to return safe metadata and a sixty-second presigned B2 GET URL only after an access check. Set response disposition from a sanitized filename.

- [ ] Implement `shareFileWithAgent` and `revokeFileAgent`. Only the creating Agent and Account owner may change grants. Target Agent must belong to the same Account.

- [ ] Implement owner routes for metadata listing/detail, granting, revocation, download authorization, and deletion. Do not proxy normal File bytes through Next.js.

- [ ] Ensure generated GET URLs are excluded from logs, Activity Records, analytics, and cached browser state. Owner route responses use `Cache-Control: no-store`.

- [ ] Run `npm test -- __tests__/files/access.test.ts __tests__/files/owner-routes.test.ts`; expect all access matrix tests to pass.

- [ ] Commit:

```bash
git add lib/files/presenter.ts lib/files/service.ts app/api/files __tests__/files/access.test.ts __tests__/files/owner-routes.test.ts
git commit -m "feat: add private file access grants"
```

## Task 5: Implement short-lived revocable Sharing Links

**Files:**

- Modify: `lib/files/service.ts`
- Create: `app/share/[token]/route.ts`
- Test: `__tests__/files/sharing-links.test.ts`
- Test: `__tests__/files/share-route.test.ts`

- [ ] Write tests for one-time links, finite download counts, expiry, revocation, concurrent final download, deleted/expired File, unknown token, and response cache headers.

- [ ] Implement link creation with a requested expiry capped by the File's own expiry and seven days. Return the plaintext `https://.../share/<token>` once and store only its hash and display prefix.

- [ ] On link use, atomically match token hash, unrevoked state, future expiry, available File, and remaining count. Increment the count before returning an HTTP `303` to a sixty-second B2 GET URL.

- [ ] Document the revocation boundary accurately: revocation prevents new download authorizations immediately; a B2 authorization already issued can remain valid for at most sixty seconds.

- [ ] Return the same not-found response for unknown, expired, exhausted, and revoked public links. Do not reveal File metadata before redirect.

- [ ] Run `npm test -- __tests__/files/sharing-links.test.ts __tests__/files/share-route.test.ts`; expect exactly one winner for the final allowed download.

- [ ] Commit:

```bash
git add lib/files/service.ts app/share __tests__/files/sharing-links.test.ts __tests__/files/share-route.test.ts
git commit -m "feat: add revocable file sharing links"
```

## Task 6: Add deletion, restoration, expiry, and physical object cleanup hooks

**Files:**

- Modify: `lib/files/service.ts`
- Create: `app/api/trash/files/[fileId]/restore/route.ts`
- Test: `__tests__/files/lifecycle.test.ts`

- [ ] Write tests that deletion makes the File and every link inaccessible immediately, releases active storage, and preserves metadata for seven days. Restoration must re-reserve storage and must fail cleanly at the plan limit.

- [ ] Keep B2 bytes during the seven-day Trash window for user deletion. Permanent deletion and natural expiry revoke links and delete the object idempotently.

- [ ] Add service hooks `expireFiles(now)`, `purgeFiles(now)`, and `abandonPendingUploads(now)` returning safe counts. The billing/lifecycle plan will invoke them from the maintenance command.

- [ ] If B2 version deletion fails, keep a purge-needed marker with the exact object key and Version ID and retry later; do not make the File accessible again. Never rely on an unversioned DeleteObject call because it only creates a delete marker in a versioned B2 bucket.

- [ ] Run `npm test -- __tests__/files/lifecycle.test.ts`; expect restore, expiry, retry, and quota tests to pass.

- [ ] Commit:

```bash
git add lib/files/service.ts app/api/trash/files __tests__/files/lifecycle.test.ts
git commit -m "feat: add file retention and trash lifecycle"
```

## Task 7: Convert small Inbox attachments into private Files

**Files:**

- Create: `lib/inbox/attachments.ts`
- Modify: `lib/inbox/receive.ts`
- Modify: `models/InboxEvent.ts`
- Test: `__tests__/inbox/attachments.test.ts`

- [ ] Support multipart attachments only for Universal and Generic HMAC Inboxes. The entire request remains subject to the 1 MiB Inbox body limit. Stripe, GitHub, and Coolify source parsers do not reinterpret payload fields as files.

- [ ] Parse bounded multipart bytes, sanitize filenames, calculate MD5, reserve active File storage, upload each small object through `putSmallObject`, create available `FileAsset` records associated with the Inbox/Event, and attach only File IDs to Event content.

- [ ] On any failure, delete already-written B2 objects and roll back File usage and metadata before returning a failed Event acceptance. Event allowance is not consumed.

- [ ] Inbox-associated Files inherit access from the Inbox's assigned Agent and grants at read time. Do not copy grant arrays that can drift after reassignment.

- [ ] Run `npm test -- __tests__/inbox/attachments.test.ts __tests__/inbox/receive.test.ts`; expect upload rollback and inherited-access tests to pass.

- [ ] Commit:

```bash
git add lib/inbox/attachments.ts lib/inbox/receive.ts models/InboxEvent.ts __tests__/inbox/attachments.test.ts
git commit -m "feat: preserve small inbox attachments as files"
```

## Task 8: Register File MCP tools and matching `/v1` routes

**Files:**

- Create: `lib/files/operations.ts`
- Modify: `lib/contracts/registry.ts`
- Create: `app/v1/files/route.ts`
- Create: `app/v1/files/[fileId]/route.ts`
- Create: `app/v1/files/[fileId]/complete/route.ts`
- Create: `app/v1/files/[fileId]/access/route.ts`
- Create: `app/v1/files/[fileId]/links/route.ts`
- Create: `app/v1/files/[fileId]/links/[linkId]/route.ts`
- Test: `__tests__/files/operations.test.ts`
- Test: `__tests__/files/contracts.test.ts`

- [ ] Register exactly `file_create_upload`, `file_complete_upload`, `file_get`, `file_share_with_agent`, `file_revoke_agent`, `file_create_link`, `file_revoke_link`, and `file_delete`.

- [ ] Expose matching advanced HTTP routes using Connection bearer auth and the same operation definitions. Do not add an arbitrary URL import operation.

- [ ] Ensure `file_get` and upload creation return expiring URLs with explicit `expiresAt`; tool descriptions must tell the Agent not to persist or disclose them beyond the intended recipient.

- [ ] Regenerate contracts and run:

```bash
npm run generate:contracts
npm test -- __tests__/files/operations.test.ts __tests__/files/contracts.test.ts __tests__/contracts
```

Expected: all eight File operations match across MCP, OpenAPI, docs data, and examples.

- [ ] Commit:

```bash
git add lib/files/operations.ts lib/contracts/registry.ts app/v1/files public/openapi.json public/llms.txt __tests__/files
git commit -m "feat: expose private files to agents"
```

## Task 9: Files security and vertical-slice gate

**Files:**

- Create: `__tests__/security/files-isolation.test.ts`
- Create: `__tests__/integration/files-journey.test.ts`

- [ ] Prove two-Account isolation for metadata, grants, completion, direct GET authorization, links, deletion, restore, Inbox inheritance, and object-key guessing.

- [ ] Complete the full journey: presigned upload, finalize, owner/Agent download, same-Account share, revoke, limited public link, revoke, delete, restore, expire, and physical purge.

- [ ] Run:

```bash
B2_INTEGRATION_TEST=1 npm test -- __tests__/files/storage.b2.test.ts __tests__/integration/files-journey.test.ts
npm test
npm run check:contracts
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit `0`; direct unsigned B2 reads fail; `rg -n "public-read|file-host|fetch.*url" lib/files app/v1/files` returns no unsafe behavior.

- [ ] Commit:

```bash
git add __tests__/security/files-isolation.test.ts __tests__/integration/files-journey.test.ts
git commit -m "test: verify private file transport"
```
