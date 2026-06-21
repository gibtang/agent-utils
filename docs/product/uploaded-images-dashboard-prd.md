# AgentUtils — Uploaded Images Dashboard PRD

**Date:** 2026-06-21  
**Status:** Ready for implementation scoping  
**Audience:** Builder agent, QA agent  
**Feature owner:** Product / founder  
**Primary surface:** `app/dashboard/page.tsx`  
**Related tool:** Image Upload (`POST /api/upload`)

---

## 1. Summary

AgentUtils currently lets agents upload images through `POST /api/upload` and returns a hosted `/api/file-host/{id}` URL, but the founder has no dashboard view of uploaded images after the response is lost. Add an **Uploads** tab to the authenticated dashboard where the signed-in user can view, preview, copy, open, and delete uploaded image records.

This feature turns Image Upload from a stateless utility into an inspectable artifact surface for agent workflows, visual QA evidence, generated images, and screenshots.

---

## 2. Current Repo Facts

Verified files in `/home/gibson/my-files/agent-utils`:

- `app/dashboard/page.tsx`
  - Current dashboard tabs: `API Keys`, `Approvals`, `Dead Letters`.
  - No uploaded image/file gallery exists.
- `app/api/upload/route.ts`
  - Current `POST /api/upload` accepts multipart `file` plus optional `retentionHours`.
  - Auth uses `x-api-key` via `validateApiKey`.
  - Returns `{ id, url, filename, contentType, size, expiresAt }`.
- `lib/storage.ts`
  - `uploadFile()` uploads directly to Backblaze B2/S3-compatible storage using a UUID key.
  - Metadata is stored in object metadata only.
  - It does **not** currently persist upload metadata to MongoDB.
- `app/api/file-host/[id]/route.ts`
  - Publicly serves a file by opaque ID.
  - Expired files return 404.
- `models/File.ts`
  - File model exists with `storageId`, `userId`, `apiKeyId`, `originalName`, `contentType`, `size`, `expiresAt`, `createdAt`.
  - Current searches found no usage of `models/File` in the upload route or storage flow.
- `app/docs/image-upload/page.tsx`
  - Documents the upload and hosted URL flow.
- Existing tests:
  - `__tests__/integration/upload-route.test.ts`
  - `__tests__/integration/file-host-route.test.ts`
  - `__tests__/image-upload.test.ts`

---

## 3. Problem

Agents often upload screenshots, generated images, visual QA artifacts, and debugging evidence. The API returns a hosted URL once, but if that URL is not saved in the chat/session/log, the user cannot recover it from AgentUtils.

This creates three product problems:

1. **Low trust:** users cannot inspect what agents have uploaded under their account.
2. **Poor workflow recovery:** lost URLs mean lost visual artifacts.
3. **Weak dashboard utility:** Image Upload is a documented tool, but it has no owner-visible management UI.

---

## 4. Expected Outcome

A signed-in user can open the AgentUtils dashboard, click an **Uploads** tab, and see recent image uploads created by their API keys.

The user can:

- See thumbnails/previews for unexpired images.
- See filename, content type, size, creation date, expiry date, and upload source API key name where available.
- Copy the hosted URL.
- Open the hosted URL in a new tab.
- Delete an uploaded image and its metadata.
- Understand when an image is expired or deleted.

---

## 5. Goals

- G1: Persist metadata for every successful `POST /api/upload`.
- G2: Add an authenticated API to list the current user’s uploaded images.
- G3: Add an authenticated API to delete one uploaded image.
- G4: Add an `Uploads` dashboard tab showing recent uploaded images.
- G5: Keep public file access unchanged: existing `/api/file-host/{id}` URLs continue to work until expiry/deletion.
- G6: Preserve tenant isolation: users can only list/delete their own uploads.
- G7: Keep the MVP small enough for a focused implementation.

---

## 6. Non-Goals

- No image editing, cropping, annotation, or transformation.
- No folder/album management.
- No sharing permissions beyond the existing opaque public URL model.
- No multi-user team gallery.
- No search-by-image or OCR.
- No CDN migration.
- No large generic file manager for non-image artifacts.
- No change to the upload API contract unless needed to include metadata persistence.

---

## 7. Primary User Story

As a founder using AgentUtils with autonomous agents, I want to see images my agents uploaded so I can recover visual artifacts, inspect outputs, and delete anything I no longer need.

---

## 8. Detailed Requirements

### 8.1 Persist Upload Metadata

On successful upload, create a `File` MongoDB record linked to the authenticated user and API key.

Required fields:

- `storageId`: UUID returned by `uploadFile()` / B2 object key.
- `userId`: owner user ID from API key validation.
- `apiKeyId`: API key ID used for upload.
- `originalName`: original uploaded filename.
- `contentType`: image MIME type.
- `size`: byte size.
- `expiresAt`: expiry date.
- `createdAt`: automatic timestamp.

Implementation options:

- Preferred: keep `lib/storage.ts` storage-only and create the `File` record in `app/api/upload/route.ts` after `uploadFile()` succeeds.
- Avoid burying database writes inside `uploadFile()` unless storage and DB dependencies are already expected there.

Failure behavior:

- If B2 upload fails: return current 500 behavior; do not create metadata.
- If metadata save fails after B2 succeeds: return 500 and attempt best-effort cleanup of the B2 object via `deleteFile(id)` to avoid orphaned uploads.
- If cleanup fails: log error; do not leak internal storage details to the API response.

### 8.2 List Uploads API

Add authenticated route:

`GET /api/uploads?limit=50&cursor=<createdAt_or_id>`

Auth:

- Firebase dashboard session via `Authorization: Bearer <firebase_id_token>` is preferred for dashboard calls.
- The route must resolve the signed-in user and return only files where `File.userId === user._id`.

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mongo_file_id",
        "storageId": "b2-uuid",
        "url": "https://www.agent-utils.com/api/file-host/b2-uuid",
        "filename": "screenshot.png",
        "contentType": "image/png",
        "size": 184320,
        "expiresAt": "2026-06-22T12:00:00.000Z",
        "createdAt": "2026-06-21T12:00:00.000Z",
        "expired": false,
        "apiKey": {
          "id": "api_key_id",
          "name": "QA Agent"
        }
      }
    ],
    "nextCursor": null
  }
}
```

Sorting:

- Newest first by `createdAt` descending.

Filtering:

- MVP includes all images for the user.
- Exclude MongoDB TTL-deleted records naturally.
- Include records whose `expiresAt` is in the past if they have not yet been TTL-deleted, but mark `expired: true` and do not render thumbnail preview.

Pagination:

- MVP default `limit=50`.
- Maximum `limit=100`.
- Cursor pagination can be implemented now or deferred if the UI only needs first page. If deferred, response should still be shaped to allow `nextCursor` later.

### 8.3 Delete Upload API

Add authenticated route:

`DELETE /api/uploads/[id]`

Behavior:

- Verify the file record exists and belongs to the signed-in user.
- Delete the B2 object using `deleteFile(storageId)`.
- Delete the MongoDB `File` record.
- Return success even if the B2 object is already missing, as long as the metadata belonged to the user and is removed.

Response:

```json
{
  "success": true,
  "data": {
    "id": "mongo_file_id",
    "deleted": true
  }
}
```

Security:

- A user must not be able to delete another user’s upload by guessing Mongo IDs or storage IDs.
- Never accept `storageId` alone for deletion from the dashboard route.

### 8.4 Dashboard UI

Update `app/dashboard/page.tsx`.

Add `uploads` to the tab type:

```ts
type Tab = 'keys' | 'approvals' | 'dlq' | 'uploads';
```

Add dashboard state:

- `uploads`
- `uploadsLoading`
- `uploadsError`
- optional `uploadsCopiedId`

Add tab label:

- `Uploads`
- Optional badge: number of current uploads loaded.

Uploads empty state:

- Title: `No uploads yet.`
- Helper copy: `Images uploaded via POST /api/upload will appear here.`
- Link to `/docs/image-upload`.

Uploads list/card fields:

- Thumbnail preview for unexpired image.
- Filename.
- Content type.
- Human-readable file size.
- Created date/time.
- Expiry date/time.
- API key name if available.
- Actions:
  - `Copy URL`
  - `Open`
  - `Delete`

Expired state:

- If `expired === true`, show a muted placeholder instead of thumbnail.
- Disable `Open` and `Copy URL` or label them as unavailable.
- Allow `Delete metadata`.

Delete confirmation:

- MVP can use `window.confirm('Delete this uploaded image?')`.
- After delete, remove the item from local state without requiring full reload.

### 8.5 Thumbnail Safety

Because `/api/file-host/[id]` is public-by-opaque-ID and image-only uploads are validated, dashboard thumbnails can use the hosted URL directly.

Requirements:

- Use standard `<img>` rather than Next Image unless remote/internal route configuration is already set.
- Add `alt` text from filename.
- Use fixed-size thumbnail container to avoid layout shift.
- If image fails to load, show fallback placeholder.

### 8.6 Docs Update

Update docs to mention dashboard visibility:

- `app/docs/image-upload/page.tsx`
  - Add a short section: `View Uploads in Dashboard`.
  - Explain that uploaded images appear in Dashboard → Uploads until expiry or deletion.

If OpenAPI is maintained manually:

- Update `public/openapi.json` for:
  - `GET /api/uploads`
  - `DELETE /api/uploads/{id}`
  - Existing `POST /api/upload` if missing/incomplete.

---

## 9. Data Model

Existing `models/File.ts` is sufficient for MVP but may need one addition for display convenience.

Current model fields:

```ts
storageId: string;
userId: mongoose.Types.ObjectId;
apiKeyId: mongoose.Types.ObjectId;
originalName: string;
contentType: string;
size: number;
expiresAt: Date;
createdAt: Date;
```

Recommended MVP additions:

- No required schema additions.

Optional later additions:

- `deletedAt` for soft delete.
- `sourceAgentName` if API keys are not expressive enough.
- `purpose` or `label` supplied by agent.
- `metadata` object for workflow IDs, QA report IDs, task IDs.

Keep MVP hard-delete to match the temporary-hosting mental model.

---

## 10. API Contracts

### 10.1 Existing Upload API Change

`POST /api/upload`

Existing response remains unchanged:

```json
{
  "success": true,
  "data": {
    "id": "storage_uuid",
    "url": "https://www.agent-utils.com/api/file-host/storage_uuid",
    "filename": "screenshot.png",
    "contentType": "image/png",
    "size": 184320,
    "expiresAt": "2026-06-22T12:00:00.000Z"
  }
}
```

Internal change:

- After successful storage upload, persist `File` record.
- `id` in the upload response remains the public storage ID to avoid breaking existing clients.

### 10.2 List Uploads

`GET /api/uploads`

Query params:

- `limit`: optional, default 50, max 100.
- `cursor`: optional, reserved for pagination.

Status codes:

- `200`: success.
- `401`: not signed in.
- `500`: database/server error.

### 10.3 Delete Upload

`DELETE /api/uploads/[id]`

Path param:

- `[id]`: Mongo `File` document ID, not storage ID.

Status codes:

- `200`: deleted.
- `401`: not signed in.
- `404`: file not found or not owned by user.
- `500`: database/server error.

---

## 11. Security and Privacy Requirements

- Tenant isolation is mandatory.
- Dashboard list/delete routes must authenticate by signed-in user, not by public file URL.
- Public hosted URLs remain opaque capability URLs; do not add directory browsing.
- Do not expose B2 bucket names, internal object metadata, API key secret values, or storage credentials.
- Do not expose other users’ filenames, metadata, counts, or existence.
- Deleting an upload removes both DB metadata and B2 object when possible.
- Expired files should not be previewable.

---

## 12. UX Copy

Tab label:

- `Uploads`

Empty state:

- `No uploads yet.`
- `Images uploaded via POST /api/upload will appear here.`
- CTA: `Read Image Upload docs`

Expired placeholder:

- `Expired`
- `This hosted image is no longer available.`

Delete confirmation:

- `Delete this uploaded image? This will remove the hosted URL.`

Toast messages:

- `Image URL copied.`
- `Upload deleted.`
- `Failed to load uploads.`
- `Failed to delete upload.`

---

## 13. Implementation Notes

Likely files to change:

- `app/api/upload/route.ts`
  - Import `File` model and `connectDB`/Mongo helper as used elsewhere.
  - Save metadata after `uploadFile()` succeeds.
- `models/File.ts`
  - Confirm timestamps and indexes are correct.
  - Keep TTL index on `expiresAt`.
- `app/api/uploads/route.ts`
  - New list route.
- `app/api/uploads/[id]/route.ts`
  - New delete route.
- `app/dashboard/page.tsx`
  - Add Uploads tab and UI.
- `app/docs/image-upload/page.tsx`
  - Add dashboard note.
- `public/openapi.json`
  - Add/update upload listing/deletion endpoints if OpenAPI is maintained manually.
- Tests:
  - Extend `__tests__/integration/upload-route.test.ts` for metadata persistence.
  - Add `__tests__/integration/uploads-route.test.ts`.
  - Add dashboard component tests only if current testing setup supports it cleanly.

Use existing response helpers:

- `lib/response.ts`

Use existing auth patterns:

- API-key auth remains for `POST /api/upload`.
- Dashboard session auth should follow patterns from `app/api/keys/route.ts` and `app/api/billing/usage/route.ts`.

---

## 14. Acceptance Criteria

### AC1 — Upload creates metadata

Given a valid API key and valid image file  
When `POST /api/upload` succeeds  
Then a `File` document is created with the correct `storageId`, `userId`, `apiKeyId`, filename, content type, size, and expiry.

### AC2 — Upload response remains backward compatible

Given an existing client uploads an image  
When the upload succeeds  
Then the response still includes `id`, `url`, `filename`, `contentType`, `size`, and `expiresAt` with the same meanings as before.

### AC3 — Dashboard can list uploads

Given a signed-in user has uploaded images  
When they open Dashboard → Uploads  
Then they see their recent uploaded images newest-first.

### AC4 — Tenant isolation

Given User A and User B both have uploads  
When User A calls `GET /api/uploads`  
Then User A sees only User A’s uploads and never User B’s uploads.

### AC5 — Delete upload

Given a signed-in user owns an upload  
When they click Delete and confirm  
Then the hosted file is deleted if present, the metadata is removed, and the item disappears from the dashboard.

### AC6 — Delete cannot cross tenants

Given User A knows User B’s file document ID  
When User A calls `DELETE /api/uploads/{id}`  
Then the API returns 404 and User B’s file remains intact.

### AC7 — Expired upload UI

Given an upload record exists with `expiresAt` in the past  
When the user opens the Uploads tab  
Then the item is marked expired and does not show a broken thumbnail as if it were active.

### AC8 — Empty state

Given a signed-in user has no uploads  
When they open the Uploads tab  
Then they see the empty-state copy and a link to Image Upload docs.

### AC9 — Error state

Given the uploads API fails  
When the user opens the Uploads tab  
Then the dashboard shows a non-crashing error state and allows retry by switching tabs/reloading.

---

## 15. Definition of Done

- [ ] Every successful `POST /api/upload` creates a `File` metadata record.
- [ ] `GET /api/uploads` returns only the signed-in user’s uploads.
- [ ] `DELETE /api/uploads/[id]` deletes only owned uploads and removes storage object best-effort.
- [ ] Dashboard has an `Uploads` tab.
- [ ] Uploads tab supports loading, empty, populated, expired, error, and delete states.
- [ ] User can copy and open active hosted URLs from the dashboard.
- [ ] Docs mention Dashboard → Uploads.
- [ ] OpenAPI is updated if it is the source of public API docs.
- [ ] Tests cover upload metadata creation, list isolation, delete behavior, and cross-tenant denial.
- [ ] Existing upload and file-host tests still pass.
- [ ] No API key secrets or internal storage details are exposed in dashboard/API responses.

---

## 16. Suggested Test Plan

### Unit / integration tests

1. `POST /api/upload` creates `File` record after storage success.
2. `POST /api/upload` does not create `File` record when validation fails.
3. `POST /api/upload` attempts cleanup when metadata save fails after storage success.
4. `GET /api/uploads` requires Firebase auth.
5. `GET /api/uploads` returns newest-first uploads for signed-in user only.
6. `GET /api/uploads` marks expired records.
7. `DELETE /api/uploads/[id]` removes owned file metadata and calls `deleteFile(storageId)`.
8. `DELETE /api/uploads/[id]` returns 404 for another user’s file.
9. `DELETE /api/uploads/[id]` succeeds if storage object is already missing but metadata is owned.

### Manual QA

1. Sign in.
2. Create/copy API key.
3. Upload image using docs curl command.
4. Open Dashboard → Uploads.
5. Confirm thumbnail and metadata display.
6. Copy URL and verify clipboard value opens correctly.
7. Delete upload.
8. Refresh dashboard and verify it no longer appears.
9. Open old hosted URL and verify 404 or missing object behavior.

---

## 17. Future Enhancements

Defer until the basic gallery proves useful:

- Add label/purpose field at upload time.
- Add `workflowId`, `taskId`, or `agentRunId` metadata.
- Add filtering by API key.
- Add image retention presets in dashboard.
- Add bulk delete expired uploads.
- Add a generic Artifact Bus for non-image files.
- Add audit log events for upload/delete actions.

---

## 18. Product Decision

Build this as a small dashboard enhancement, not a broad asset manager.

The user need is not “Dropbox for agents.” The user need is: **recover and inspect images uploaded by agents.** Keep the MVP constrained to recent image uploads, simple preview, URL recovery, and delete.
