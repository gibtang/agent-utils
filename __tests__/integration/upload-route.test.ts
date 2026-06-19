import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockValidateApiKey = vi.fn();
const mockUploadFile = vi.fn();

vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  authErrorResponse: (error: { error: string; statusCode: number }) =>
    new Response(JSON.stringify({ error: error.error, code: `HTTP_${error.statusCode}` }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    }),
}));
vi.mock('@/lib/storage', () => ({
  // defer to the factory so per-test values apply
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAuthResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true as const,
    apiKey: { _id: 'key123', userId: 'user123', name: 'test-key', tier: 'builder', key: 'ak_test', ...overrides },
  };
}

function makeUploadRequest(opts: {
  filename?: string;
  type?: string;
  bytes?: Uint8Array;
  retentionHours?: number;
} = {}) {
  const { filename = 'photo.png', type = 'image/png', bytes = new Uint8Array([1, 2, 3, 4]), retentionHours } = opts;
  const form = new FormData();
  const file = new File([bytes], filename, { type });
  form.append('file', file);
  if (retentionHours !== undefined) form.append('retentionHours', String(retentionHours));

  return new NextRequest('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: { 'x-api-key': 'ak_test' },
    body: form,
  });
}

async function parseResponse(response: Response) {
  return { status: response.status, body: await response.json() };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/upload', () => {
  let POST: typeof import('@/app/api/upload/route').POST;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/upload/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
    mockUploadFile.mockResolvedValue({
      id: 'b2-uuid-123',
      url: 'http://localhost:3000/api/file-host/b2-uuid-123',
      filename: 'photo.png',
      contentType: 'image/png',
      size: 4,
      expiresAt: '2026-06-20T00:00:00.000Z',
    });
  });

  it('auths with x-api-key and returns 201 with the hosted URL', async () => {
    const res = await POST(makeUploadRequest());
    const { status, body } = await parseResponse(res);

    expect(mockValidateApiKey).toHaveBeenCalledTimes(1);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.url).toContain('/api/file-host/b2-uuid-123');
    expect(body.data.id).toBe('b2-uuid-123');
    expect(body.data.contentType).toBe('image/png');
  });

  it('forwards the uploaded bytes to uploadFile', async () => {
    const payload = new Uint8Array([10, 20, 30]);
    await POST(makeUploadRequest({ bytes: payload }));

    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    const [buf, filename, contentType] = mockUploadFile.mock.calls[0];
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(Array.from(buf as Uint8Array)).toEqual([10, 20, 30]);
    expect(filename).toBe('photo.png');
    expect(contentType).toBe('image/png');
  });

  it('defaults retention to 24 hours', async () => {
    await POST(makeUploadRequest());
    const [, , , retentionHours] = mockUploadFile.mock.calls[0];
    expect(retentionHours).toBe(24);
  });

  it('honors an explicit retentionHours', async () => {
    await POST(makeUploadRequest({ retentionHours: 72 }));
    const [, , , retentionHours] = mockUploadFile.mock.calls[0];
    expect(retentionHours).toBe(72);
  });

  it('returns 401 when auth fails', async () => {
    mockValidateApiKey.mockResolvedValue({ success: false, error: 'Missing x-api-key header', statusCode: 401 });
    const res = await POST(makeUploadRequest());
    expect((await parseResponse(res)).status).toBe(401);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('returns 400 when no file field is present', async () => {
    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'x-api-key': 'ak_test' },
      body: new FormData(),
    });
    const res = await POST(req);
    expect((await parseResponse(res)).status).toBe(400);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('returns 415 for a non-image content type', async () => {
    const res = await POST(makeUploadRequest({ filename: 'doc.pdf', type: 'application/pdf' }));
    expect((await parseResponse(res)).status).toBe(415);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('returns 413 when the file exceeds the size limit', async () => {
    // Build a buffer larger than MAX_IMAGE_BYTES without allocating 10MB:
    // mock validateImage? No — instead stub the File size via a tiny payload
    // but override .size. Simpler: just check that a huge declared size is rejected.
    // We approximate by sending a file whose declared size is over the limit.
    const huge = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await POST(makeUploadRequest({ bytes: huge }));
    expect((await parseResponse(res)).status).toBe(413);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('returns 500 when storage fails', async () => {
    mockUploadFile.mockRejectedValue(new Error('B2 down'));
    const res = await POST(makeUploadRequest());
    expect((await parseResponse(res)).status).toBe(500);
  });
});
