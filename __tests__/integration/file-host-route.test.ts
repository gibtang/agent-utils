import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetFile = vi.fn();
vi.mock('@/lib/storage', () => ({
  getFile: (...args: unknown[]) => mockGetFile(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/file-host/${id}`, {
    method: 'GET',
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/file-host/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/file-host/[id]/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the file with its content type', async () => {
    mockGetFile.mockResolvedValue({
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      contentType: 'image/png',
      metadata: { originalname: 'photo.png' },
    });

    const res = await GET(makeRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBeTruthy();
    const body = Buffer.from(await res.arrayBuffer());
    expect(Array.from(body)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(mockGetFile).toHaveBeenCalledWith('abc');
  });

  it('falls back to octet-stream when content type is missing', async () => {
    mockGetFile.mockResolvedValue({
      data: Buffer.from('x'),
      contentType: 'application/octet-stream',
      metadata: {},
    });

    const res = await GET(makeRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
  });

  it('returns 404 when the file does not exist or has expired', async () => {
    mockGetFile.mockResolvedValue(null);

    const res = await GET(makeRequest('missing'), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when getFile throws', async () => {
    mockGetFile.mockRejectedValue(new Error('B2 unavailable'));

    const res = await GET(makeRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(404);
  });
});
