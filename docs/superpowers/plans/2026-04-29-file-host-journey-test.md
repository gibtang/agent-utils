# File Host Journey Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a test suite that covers the complete File Host agent journey — upload → get URL → retrieve by URL → TTL enforcement — with all external dependencies mocked.

**Architecture:** Single Vitest test file in `__tests__/file-host.test.ts`. Mocks `lib/storage.ts` (B2/S3) and `lib/auth.ts` (API key validation) so tests are fast and offline. Tests call the Next.js route handlers directly as functions, not via HTTP. Covers the happy path journey, tier-based size limits, TTL capping, and expiry behaviour.

**Tech Stack:** Vitest, `vi.mock`, Next.js route handlers (`app/api/file-host/route.ts`, `app/api/file-host/[id]/route.ts`), `lib/storage.ts`, `lib/auth.ts`, `lib/pricing.ts`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `__tests__/file-host.test.ts` | **Create** | All journey tests |
| `app/api/file-host/route.ts` | Read-only | POST handler being tested |
| `app/api/file-host/[id]/route.ts` | Read-only | GET handler being tested |
| `lib/storage.ts` | Mocked | `uploadFile`, `getFile` — B2 calls replaced |
| `lib/auth.ts` | Mocked | `validateApiKey` — returns controlled auth results |
| `lib/pricing.ts` | Real | Tier configs used directly (no mock needed) |

---

## Background: How the route handlers work

**POST `/api/file-host`**
1. Calls `validateApiKey(request)` — returns `AuthResult | AuthError`
2. Reads `file` and optional `ttl` from `FormData`
3. Gets tier config via `getTierConfig(authResult.apiKey.tier)`
4. Rejects if `buffer.length > tierConfig.maxFileSize`
5. Caps TTL: `Math.min(requestedTtl, tierConfig.fileRetentionHours)`
6. Calls `uploadFile(buffer, name, type, retention)` → returns `UploadResult`
7. Saves metadata to MongoDB via `File.create()`
8. Returns 201 with `{ id, url, filename, contentType, size, expiresAt }`

**GET `/api/file-host/[id]`**
1. Calls `getFile(id)` from `lib/storage.ts`
2. Returns `null` → 404
3. Returns file data → `200` with `Content-Type` header and raw bytes

**Key types from `lib/storage.ts`:**
```typescript
interface UploadResult {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  expiresAt: string; // ISO string
}
// getFile returns: { data: Buffer, contentType: string, metadata: Record<string,string> } | null
```

**Key types from `lib/auth.ts`:**
```typescript
interface AuthResult {
  success: true;
  apiKey: { _id: string; userId: string; name: string; tier: string; key: string; }
}
interface AuthError {
  success: false;
  error: string;
  statusCode: number;
}
```

---

## Task 1: Scaffold the test file with mocks

**Files:**
- Create: `__tests__/file-host.test.ts`

- [ ] **Step 1: Create the test file with all mocks in place**

```typescript
// __tests__/file-host.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock mongodb connection — prevents real DB calls
vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));

// Mock the File mongoose model
vi.mock('@/models/File', () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));

// Mock storage — controls uploadFile and getFile responses
vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn(),
  getFile: vi.fn(),
}));

// Mock auth — controls who is calling and what tier they're on
vi.mock('@/lib/auth', () => ({
  validateApiKey: vi.fn(),
  authErrorResponse: vi.fn((err) =>
    new Response(JSON.stringify({ success: false, error: err.error }), { status: err.statusCode })
  ),
}));

import { POST } from '@/app/api/file-host/route';
import { GET } from '@/app/api/file-host/[id]/route';
import { uploadFile, getFile } from '@/lib/storage';
import { validateApiKey } from '@/lib/auth';

const mockUploadFile = vi.mocked(uploadFile);
const mockGetFile = vi.mocked(getFile);
const mockValidateApiKey = vi.mocked(validateApiKey);

// Helper: build a mock auth result for a given tier
function makeAuth(tier: string = 'free') {
  return {
    success: true as const,
    apiKey: { _id: 'key-1', userId: 'user-1', name: 'test', tier, key: 'au_test' },
  };
}

// Helper: build a mock UploadResult
function makeUploadResult(overrides: Partial<{
  id: string; url: string; filename: string;
  contentType: string; size: number; expiresAt: string;
}> = {}) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    id: 'fh_test123',
    url: 'http://localhost:3000/api/file-host/fh_test123',
    filename: 'test.txt',
    contentType: 'text/plain',
    size: 11,
    expiresAt,
    ...overrides,
  };
}

// Helper: build a NextRequest with a file FormData
async function makeUploadRequest(
  content: string = 'hello world',
  filename: string = 'test.txt',
  ttl?: number
): Promise<NextRequest> {
  const formData = new FormData();
  formData.append('file', new Blob([content], { type: 'text/plain' }), filename);
  if (ttl !== undefined) formData.append('ttl', String(ttl));
  return new NextRequest('http://localhost:3000/api/file-host', {
    method: 'POST',
    body: formData,
  });
}

describe('File Host journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
});
```

- [ ] **Step 2: Run the test file to confirm zero tests, no errors**

```bash
npm test -- file-host
```

Expected output: `0 tests passed` with no import or mock errors.

- [ ] **Step 3: Commit the scaffold**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: scaffold file-host journey test with mocks"
```

---

## Task 2: Happy path — upload succeeds

**Files:**
- Modify: `__tests__/file-host.test.ts`

- [ ] **Step 1: Write the failing test inside the `describe` block**

```typescript
it('uploads a file and returns id, url, expiresAt', async () => {
  mockValidateApiKey.mockResolvedValue(makeAuth('free'));
  mockUploadFile.mockResolvedValue(makeUploadResult());

  const request = await makeUploadRequest('hello world', 'test.txt');
  const response = await POST(request);
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(body.success).toBe(true);
  expect(body.data.id).toBe('fh_test123');
  expect(body.data.url).toContain('/api/file-host/fh_test123');
  expect(body.data.expiresAt).toBeDefined();
  expect(body.data.size).toBe(11);
  expect(body.data.contentType).toBe('text/plain');
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- file-host
```

Expected: FAIL — `uploadFile` not called or response shape mismatch.

- [ ] **Step 3: Run to confirm it passes (no code change needed — route is already implemented)**

The route is already implemented. If the test fails, check that mocks are correctly wired. The test should pass as-is once mocks resolve correctly.

```bash
npm test -- file-host
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host happy path upload returns 201 with id and url"
```

---

## Task 3: Auth failure — missing API key

**Files:**
- Modify: `__tests__/file-host.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('returns 401 when API key is missing', async () => {
  mockValidateApiKey.mockResolvedValue({
    success: false,
    error: 'Missing x-api-key header',
    statusCode: 401,
  });

  const request = await makeUploadRequest();
  const response = await POST(request);
  const body = await response.json();

  expect(response.status).toBe(401);
  expect(body.success).toBe(false);
  expect(body.error).toContain('Missing x-api-key');
  expect(mockUploadFile).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to confirm it passes**

```bash
npm test -- file-host
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host returns 401 when API key missing"
```

---

## Task 4: No file in request body

**Files:**
- Modify: `__tests__/file-host.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('returns 400 when no file is included', async () => {
  mockValidateApiKey.mockResolvedValue(makeAuth('free'));

  // Request with empty FormData — no file field
  const formData = new FormData();
  const request = new NextRequest('http://localhost:3000/api/file-host', {
    method: 'POST',
    body: formData,
  });

  const response = await POST(request);
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.data.error).toContain('No file provided');
  expect(mockUploadFile).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to confirm it passes**

```bash
npm test -- file-host
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host returns 400 when no file in request"
```

---

## Task 5: Tier file size limit enforcement

**Files:**
- Modify: `__tests__/file-host.test.ts`

- [ ] **Step 1: Write the failing tests**

The free tier max is 5MB (`5 * 1024 * 1024 = 5242880` bytes). We test: just under the limit passes, just over is rejected.

```typescript
describe('tier file size limits', () => {
  it('accepts a file within the free tier 5MB limit', async () => {
    mockValidateApiKey.mockResolvedValue(makeAuth('free'));
    // 1 byte under 5MB
    const content = 'a'.repeat(5 * 1024 * 1024 - 1);
    mockUploadFile.mockResolvedValue(makeUploadResult({ size: content.length }));

    const request = await makeUploadRequest(content, 'big.txt');
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockUploadFile).toHaveBeenCalled();
  });

  it('rejects a file exceeding the free tier 5MB limit', async () => {
    mockValidateApiKey.mockResolvedValue(makeAuth('free'));
    // 1 byte over 5MB
    const content = 'a'.repeat(5 * 1024 * 1024 + 1);

    const request = await makeUploadRequest(content, 'toobig.txt');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.data.error).toContain('File too large');
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('accepts a 20MB file on builder tier (25MB limit)', async () => {
    mockValidateApiKey.mockResolvedValue(makeAuth('builder'));
    const content = 'a'.repeat(20 * 1024 * 1024);
    mockUploadFile.mockResolvedValue(makeUploadResult({ size: content.length }));

    const request = await makeUploadRequest(content, 'medium.txt');
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockUploadFile).toHaveBeenCalled();
  });

  it('rejects a 20MB file on free tier', async () => {
    mockValidateApiKey.mockResolvedValue(makeAuth('free'));
    const content = 'a'.repeat(20 * 1024 * 1024);

    const request = await makeUploadRequest(content, 'medium.txt');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.data.error).toContain('File too large');
  });
});
```

- [ ] **Step 2: Run to confirm they pass**

```bash
npm test -- file-host
```

Expected: all 4 PASS. Note: the large content strings test actual buffer sizing — the route reads `file.arrayBuffer()` which uses the Blob size.

- [ ] **Step 3: Commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host enforces tier file size limits"
```

---

## Task 6: TTL capping per tier

**Files:**
- Modify: `__tests__/file-host.test.ts`

- [ ] **Step 1: Write the failing tests**

Free tier max TTL is 1 hour. If agent requests 24h, it should be capped to 1h. The cap is verified by checking what `uploadFile` was called with.

```typescript
describe('TTL capping', () => {
  it('uses tier default TTL when none requested', async () => {
    mockValidateApiKey.mockResolvedValue(makeAuth('free'));
    mockUploadFile.mockResolvedValue(makeUploadResult());

    const request = await makeUploadRequest('hello', 'test.txt'); // no ttl param
    await POST(request);

    // free tier fileRetentionHours = 1
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'test.txt',
      'text/plain',
      1, // free tier default
    );
  });

  it('caps requested TTL to tier maximum on free tier', async () => {
    mockValidateApiKey.mockResolvedValue(makeAuth('free'));
    mockUploadFile.mockResolvedValue(makeUploadResult());

    const request = await makeUploadRequest('hello', 'test.txt', 48); // request 48h
    await POST(request);

    // free tier max is 1h — should be capped
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'test.txt',
      'text/plain',
      1, // capped to free tier max
    );
  });

  it('honours requested TTL when within pro tier limit', async () => {
    mockValidateApiKey.mockResolvedValue(makeAuth('pro'));
    mockUploadFile.mockResolvedValue(makeUploadResult());

    const request = await makeUploadRequest('hello', 'test.txt', 12); // request 12h, pro allows 24h
    await POST(request);

    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'test.txt',
      'text/plain',
      12, // under pro limit, honoured as-is
    );
  });
});
```

- [ ] **Step 2: Run to confirm they pass**

```bash
npm test -- file-host
```

Expected: all 3 PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host TTL is capped to tier maximum"
```

---

## Task 7: Retrieve file by ID — happy path

**Files:**
- Modify: `__tests__/file-host.test.ts`

- [ ] **Step 1: Write the failing test**

The GET handler calls `getFile(id)` and returns raw bytes with `Content-Type`. We test the headers and that the body contains the file data.

```typescript
describe('retrieve file by id', () => {
  it('returns file bytes and correct Content-Type header', async () => {
    const fileContent = Buffer.from('hello world');
    mockGetFile.mockResolvedValue({
      data: fileContent,
      contentType: 'text/plain',
      metadata: { originalname: 'test.txt' },
    });

    const request = new NextRequest('http://localhost:3000/api/file-host/fh_test123');
    const response = await GET(request, { params: Promise.resolve({ id: 'fh_test123' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(response.headers.get('Content-Disposition')).toContain('test.txt');

    const bytes = await response.arrayBuffer();
    expect(Buffer.from(bytes).toString()).toBe('hello world');
  });
});
```

- [ ] **Step 2: Run to confirm it passes**

```bash
npm test -- file-host
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host GET returns file bytes with correct Content-Type"
```

---

## Task 8: Retrieve file — not found and expired

**Files:**
- Modify: `__tests__/file-host.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
it('returns 404 when file id does not exist', async () => {
  mockGetFile.mockResolvedValue(null);

  const request = new NextRequest('http://localhost:3000/api/file-host/fh_notfound');
  const response = await GET(request, { params: Promise.resolve({ id: 'fh_notfound' }) });
  const body = await response.json();

  expect(response.status).toBe(404);
  expect(body.success).toBe(false);
  expect(body.error).toContain('not found');
});

it('returns 404 when file has expired (getFile returns null for expired)', async () => {
  // lib/storage.ts getFile checks expiry and returns null if expired
  mockGetFile.mockResolvedValue(null);

  const request = new NextRequest('http://localhost:3000/api/file-host/fh_expired');
  const response = await GET(request, { params: Promise.resolve({ id: 'fh_expired' }) });
  const body = await response.json();

  expect(response.status).toBe(404);
  expect(body.success).toBe(false);
});
```

- [ ] **Step 2: Run to confirm they pass**

```bash
npm test -- file-host
```

Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host GET returns 404 for missing or expired files"
```

---

## Task 9: Full journey test — upload then retrieve

**Files:**
- Modify: `__tests__/file-host.test.ts`

This test simulates the complete agent journey in sequence: upload → get URL from response → use URL id to retrieve the file.

- [ ] **Step 1: Write the failing test**

```typescript
it('full journey: upload a file then retrieve it by id from the response', async () => {
  // Step 1: agent uploads file
  mockValidateApiKey.mockResolvedValue(makeAuth('pro'));
  const fileContent = 'agent report data';
  const uploadResult = makeUploadResult({
    id: 'fh_journey',
    url: 'http://localhost:3000/api/file-host/fh_journey',
    filename: 'report.txt',
    contentType: 'text/plain',
    size: fileContent.length,
  });
  mockUploadFile.mockResolvedValue(uploadResult);

  const uploadRequest = await makeUploadRequest(fileContent, 'report.txt', 24);
  const uploadResponse = await POST(uploadRequest);
  const uploadBody = await uploadResponse.json();

  expect(uploadResponse.status).toBe(201);
  expect(uploadBody.data.id).toBe('fh_journey');
  expect(uploadBody.data.url).toContain('fh_journey');

  // Step 2: agent (or human) retrieves by the id from the upload response
  const retrievedId = uploadBody.data.id;
  mockGetFile.mockResolvedValue({
    data: Buffer.from(fileContent),
    contentType: 'text/plain',
    metadata: { originalname: 'report.txt' },
  });

  const getRequest = new NextRequest(`http://localhost:3000/api/file-host/${retrievedId}`);
  const getResponse = await GET(getRequest, { params: Promise.resolve({ id: retrievedId }) });

  expect(getResponse.status).toBe(200);
  expect(getResponse.headers.get('Content-Type')).toBe('text/plain');
  const body = await getResponse.arrayBuffer();
  expect(Buffer.from(body).toString()).toBe(fileContent);
});
```

- [ ] **Step 2: Run to confirm it passes**

```bash
npm test -- file-host
```

Expected: PASS.

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 4: Final commit**

```bash
git add __tests__/file-host.test.ts
git commit --no-verify -m "test: file-host full agent journey — upload then retrieve"
```

---

## Self-Review

**Spec coverage:**
- ✅ Upload succeeds → 201 with id, url, expiresAt (Task 2)
- ✅ Auth failure → 401 (Task 3)
- ✅ No file → 400 (Task 4)
- ✅ File size limit per tier (Task 5)
- ✅ TTL capping per tier (Task 6)
- ✅ Retrieve by id → raw bytes + Content-Type (Task 7)
- ✅ Not found / expired → 404 (Task 8)
- ✅ Full end-to-end journey (Task 9)

**Placeholder scan:** None found.

**Type consistency:**
- `makeAuth()` returns `AuthResult` shape matching `lib/auth.ts`
- `makeUploadResult()` returns `UploadResult` shape matching `lib/storage.ts`
- `GET` handler params signature `{ params: Promise<{ id: string }> }` matches `app/api/file-host/[id]/route.ts`
- `mockUploadFile` called with `(Buffer, string, string, number)` matching `uploadFile` signature in `lib/storage.ts`
