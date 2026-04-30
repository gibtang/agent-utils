import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TIERS } from '@/lib/pricing';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockValidateApiKey = vi.fn();
const mockIncrementQuota = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  authErrorResponse: (error: { error: string; statusCode: number }) =>
    new Response(JSON.stringify({ error: error.error, code: `HTTP_${error.statusCode}` }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    }),
  incrementQuota: (...args: unknown[]) => mockIncrementQuota(...args),
}));

// KvEntry model mock — chainable query builder
const mockKvEntry = {
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOneAndDelete: vi.fn(),
  countDocuments: vi.fn(),
  create: vi.fn(),
};

function chainableQuery(resolvedValue: unknown) {
  const q: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
  };
  // Make it also thenable for direct await
  q.then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve);
  q.catch = () => q;
  return q;
}

vi.mock('@/models/KvEntry', () => ({
  default: mockKvEntry,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAuthResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true as const,
    apiKey: {
      _id: 'key123',
      userId: 'user123',
      name: 'test-key',
      tier: 'free',
      key: 'ak_test123',
      ...overrides,
    },
  };
}

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const url = `http://localhost:3000${path}`;
  const init: RequestInit = {
    method,
    headers: { 'x-api-key': 'ak_test123', ...headers },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  return new NextRequest(url, init);
}

async function parseResponse(response: Response) {
  const json = await response.json();
  return { status: response.status, body: json };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('KV Store Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
    mockIncrementQuota.mockResolvedValue(undefined);
  });

  // ── GET /api/kv — List keys ────────────────────────────────────────────

  describe('GET /api/kv (list)', () => {
    let listGet: typeof import('@/app/api/kv/route').GET;

    beforeAll(async () => {
      const mod = await import('@/app/api/kv/route');
      listGet = mod.GET;
    });

    it('returns 401 when no API key provided', async () => {
      mockValidateApiKey.mockResolvedValue({
        success: false,
        error: 'Missing x-api-key header',
        statusCode: 401,
      });

      const res = await listGet(makeRequest('GET', '/api/kv'));
      expect(res.status).toBe(401);
    });

    it('returns paginated list of keys', async () => {
      const items = [
        { key: 'foo', expiresAt: new Date() },
        { key: 'bar', expiresAt: new Date() },
      ];
      mockKvEntry.find.mockReturnValue(chainableQuery(items));
      mockKvEntry.countDocuments.mockResolvedValue(2);

      const res = await listGet(makeRequest('GET', '/api/kv?limit=10&offset=0'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.total).toBe(2);
      expect(body.data.limit).toBe(10);
      expect(body.data.offset).toBe(0);
    });

    it('clamps limit to 100 max', async () => {
      mockKvEntry.find.mockReturnValue(chainableQuery([]));
      mockKvEntry.countDocuments.mockResolvedValue(0);

      const res = await listGet(makeRequest('GET', '/api/kv?limit=999'));
      const { body } = await parseResponse(res);

      expect(body.data.limit).toBe(100);
    });

    it('defaults limit to 50 and offset to 0', async () => {
      mockKvEntry.find.mockReturnValue(chainableQuery([]));
      mockKvEntry.countDocuments.mockResolvedValue(0);

      const res = await listGet(makeRequest('GET', '/api/kv'));
      const { body } = await parseResponse(res);

      expect(body.data.limit).toBe(50);
      expect(body.data.offset).toBe(0);
    });

    it('filters by apiKeyId', async () => {
      mockKvEntry.find.mockReturnValue(chainableQuery([]));
      mockKvEntry.countDocuments.mockResolvedValue(0);

      await listGet(makeRequest('GET', '/api/kv'));

      expect(mockKvEntry.find).toHaveBeenCalledWith(
        { apiKeyId: 'key123' },
      );
    });

    it('returns 500 on DB error', async () => {
      mockKvEntry.find.mockImplementation(() => { throw new Error('db fail'); });

      const res = await listGet(makeRequest('GET', '/api/kv'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(500);
      expect(body.success).toBe(false);
    });
  });

  // ── PUT /api/kv — Set key-value pair ───────────────────────────────────

  describe('PUT /api/kv (set)', () => {
    let kvPut: typeof import('@/app/api/kv/route').PUT;

    beforeAll(async () => {
      const mod = await import('@/app/api/kv/route');
      kvPut = mod.PUT;
    });

    it('rejects missing key', async () => {
      const res = await kvPut(makeRequest('PUT', '/api/kv', { value: 'hello' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.error).toContain('key');
    });

    it('rejects non-string key', async () => {
      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 123, value: 'hello' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
    });

    it('rejects key longer than 256 characters', async () => {
      const longKey = 'a'.repeat(257);
      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: longKey, value: 'v' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.error).toContain('256');
    });

    it('rejects missing value', async () => {
      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 'mykey' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.error).toContain('value');
    });

    it('rejects value exceeding kvMaxValueBytes', async () => {
      // free tier: 10240 bytes
      const bigValue = 'x'.repeat(10241);
      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 'mykey', value: bigValue }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(413);
      expect(body.error).toContain('10240');
    });

    it('rejects when key limit reached on free tier', async () => {
      mockKvEntry.countDocuments.mockResolvedValue(10); // free tier = 10 max
      mockKvEntry.findOne.mockResolvedValue(null); // not an existing key

      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 'newkey', value: 'v' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(429);
      expect(body.error).toContain('10');
    });

    it('allows overwriting existing key even at limit', async () => {
      mockKvEntry.countDocuments.mockResolvedValue(10);
      mockKvEntry.findOne.mockResolvedValue({ key: 'existing', value: 'old' });
      mockKvEntry.findOneAndUpdate.mockResolvedValue({
        key: 'existing',
        value: 'new',
        expiresAt: new Date(),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      });

      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 'existing', value: 'new' }));
      const { status } = await parseResponse(res);

      expect(status).toBe(200);
    });

    it('creates new entry (201) on first write', async () => {
      mockKvEntry.countDocuments.mockResolvedValue(0);
      mockKvEntry.findOne.mockResolvedValue(null);
      const now = new Date();
      mockKvEntry.findOneAndUpdate.mockResolvedValue({
        key: 'mykey',
        value: 'hello',
        expiresAt: now,
        createdAt: now,
        updatedAt: now, // same = created
      });

      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 'mykey', value: 'hello' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.key).toBe('mykey');
      expect(mockIncrementQuota).toHaveBeenCalledWith('user123', 'free', 'key123');
    });

    it('respects custom TTL', async () => {
      mockKvEntry.countDocuments.mockResolvedValue(0);
      mockKvEntry.findOne.mockResolvedValue(null);
      const now = new Date();
      mockKvEntry.findOneAndUpdate.mockResolvedValue({
        key: 'ttlkey',
        value: 'val',
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await kvPut(makeRequest('PUT', '/api/kv', { key: 'ttlkey', value: 'val', ttl: 3600 }));

      const call = mockKvEntry.findOneAndUpdate.mock.calls[0];
      const expiresAt = call[1].$set.expiresAt as Date;
      // ttl=3600 → expires ~1 hour from now
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(3500_000);
      expect(diff).toBeLessThan(3700_000);
    });

    it('enterprise tier bypasses key limit', async () => {
      mockValidateApiKey.mockResolvedValue(makeAuthResult({ tier: 'enterprise' }));
      mockKvEntry.countDocuments.mockResolvedValue(99999);
      mockKvEntry.findOne.mockResolvedValue(null);
      const now = new Date();
      mockKvEntry.findOneAndUpdate.mockResolvedValue({
        key: 'newkey',
        value: 'v',
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 'newkey', value: 'v' }));
      const { status } = await parseResponse(res);

      expect(status).toBe(201);
      // countDocuments should not even be checked for unlimited (-1)
      expect(mockKvEntry.countDocuments).not.toHaveBeenCalled();
    });

    it('returns 500 on DB error', async () => {
      mockKvEntry.countDocuments.mockImplementation(() => { throw new Error('db fail'); });

      const res = await kvPut(makeRequest('PUT', '/api/kv', { key: 'k', value: 'v' }));
      const { status } = await parseResponse(res);

      expect(status).toBe(500);
    });
  });

  // ── GET /api/kv/:key — Get single value ────────────────────────────────

  describe('GET /api/kv/:key (get)', () => {
    let keyGet: typeof import('@/app/api/kv/[key]/route').GET;

    beforeAll(async () => {
      const mod = await import('@/app/api/kv/[key]/route');
      keyGet = mod.GET;
    });

    it('returns value when key exists', async () => {
      mockKvEntry.findOne.mockResolvedValue({
        key: 'mykey',
        value: { nested: true },
        expiresAt: new Date(),
      });

      const req = makeRequest('GET', '/api/kv/mykey');
      const res = await keyGet(req, { params: Promise.resolve({ key: 'mykey' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.key).toBe('mykey');
      expect(body.data.value).toEqual({ nested: true });
    });

    it('returns 404 when key not found', async () => {
      mockKvEntry.findOne.mockResolvedValue(null);

      const req = makeRequest('GET', '/api/kv/missing');
      const res = await keyGet(req, { params: Promise.resolve({ key: 'missing' }) });
      const { status } = await parseResponse(res);

      expect(status).toBe(404);
    });

    it('decodes URL-encoded keys', async () => {
      mockKvEntry.findOne.mockResolvedValue({
        key: 'path/to/resource',
        value: 'data',
        expiresAt: new Date(),
      });

      const req = makeRequest('GET', '/api/kv/path%2Fto%2Fresource');
      const res = await keyGet(req, { params: Promise.resolve({ key: 'path%2Fto%2Fresource' }) });
      const { body } = await parseResponse(res);

      expect(mockKvEntry.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'path/to/resource' }),
      );
      expect(body.data.key).toBe('path/to/resource');
    });

    it('scopes lookup to apiKeyId', async () => {
      mockKvEntry.findOne.mockResolvedValue(null);

      const req = makeRequest('GET', '/api/kv/mykey');
      await keyGet(req, { params: Promise.resolve({ key: 'mykey' }) });

      expect(mockKvEntry.findOne).toHaveBeenCalledWith({
        apiKeyId: 'key123',
        key: 'mykey',
      });
    });

    it('returns 500 on DB error', async () => {
      mockKvEntry.findOne.mockImplementation(() => { throw new Error('fail'); });

      const req = makeRequest('GET', '/api/kv/mykey');
      const res = await keyGet(req, { params: Promise.resolve({ key: 'mykey' }) });
      const { status } = await parseResponse(res);

      expect(status).toBe(500);
    });
  });

  // ── DELETE /api/kv/:key ────────────────────────────────────────────────

  describe('DELETE /api/kv/:key', () => {
    let keyDelete: typeof import('@/app/api/kv/[key]/route').DELETE;

    beforeAll(async () => {
      const mod = await import('@/app/api/kv/[key]/route');
      keyDelete = mod.DELETE;
    });

    it('deletes an existing key', async () => {
      mockKvEntry.findOneAndDelete.mockResolvedValue({ key: 'mykey' });

      const req = makeRequest('DELETE', '/api/kv/mykey');
      const res = await keyDelete(req, { params: Promise.resolve({ key: 'mykey' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.deleted).toBe(true);
    });

    it('returns 404 for non-existent key', async () => {
      mockKvEntry.findOneAndDelete.mockResolvedValue(null);

      const req = makeRequest('DELETE', '/api/kv/missing');
      const res = await keyDelete(req, { params: Promise.resolve({ key: 'missing' }) });
      const { status } = await parseResponse(res);

      expect(status).toBe(404);
    });

    it('returns 500 on DB error', async () => {
      mockKvEntry.findOneAndDelete.mockImplementation(() => { throw new Error('fail'); });

      const req = makeRequest('DELETE', '/api/kv/mykey');
      const res = await keyDelete(req, { params: Promise.resolve({ key: 'mykey' }) });
      const { status } = await parseResponse(res);

      expect(status).toBe(500);
    });
  });

  // ── POST /api/kv/:key/increment ────────────────────────────────────────

  describe('POST /api/kv/:key/increment', () => {
    let incrementPost: typeof import('@/app/api/kv/[key]/increment/route').POST;

    beforeAll(async () => {
      const mod = await import('@/app/api/kv/[key]/increment/route');
      incrementPost = mod.POST;
    });

    it('creates new entry with default amount 1 when key missing', async () => {
      mockKvEntry.findOne.mockResolvedValue(null);
      mockKvEntry.create.mockResolvedValue({
        key: 'counter',
        value: 1,
      });

      const req = makeRequest('POST', '/api/kv/counter/increment', {});
      const res = await incrementPost(req, { params: Promise.resolve({ key: 'counter' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.value).toBe(1);
      expect(mockKvEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'counter', value: 1 }),
      );
    });

    it('creates new entry with custom amount', async () => {
      mockKvEntry.findOne.mockResolvedValue(null);
      mockKvEntry.create.mockResolvedValue({
        key: 'counter',
        value: 10,
      });

      const req = makeRequest('POST', '/api/kv/counter/increment', { amount: 10 });
      const res = await incrementPost(req, { params: Promise.resolve({ key: 'counter' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.value).toBe(10);
    });

    it('increments existing numeric value', async () => {
      mockKvEntry.findOne.mockResolvedValue({ key: 'counter', value: 5 });
      mockKvEntry.findOneAndUpdate.mockResolvedValue({
        key: 'counter',
        value: 8,
      });

      const req = makeRequest('POST', '/api/kv/counter/increment', { amount: 3 });
      const res = await incrementPost(req, { params: Promise.resolve({ key: 'counter' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.value).toBe(8);
      expect(mockKvEntry.findOneAndUpdate).toHaveBeenCalledWith(
        { apiKeyId: 'key123', key: 'counter' },
        { $inc: { value: 3 } },
        { new: true },
      );
    });

    it('rejects increment on non-numeric existing value', async () => {
      mockKvEntry.findOne.mockResolvedValue({ key: 'counter', value: 'not-a-number' });

      const req = makeRequest('POST', '/api/kv/counter/increment', { amount: 1 });
      const res = await incrementPost(req, { params: Promise.resolve({ key: 'counter' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.error).toContain('not numeric');
    });

    it('increments quota after successful operation', async () => {
      mockKvEntry.findOne.mockResolvedValue(null);
      mockKvEntry.create.mockResolvedValue({ key: 'c', value: 1 });

      const req = makeRequest('POST', '/api/kv/c/increment', {});
      await incrementPost(req, { params: Promise.resolve({ key: 'c' }) });

      expect(mockIncrementQuota).toHaveBeenCalledWith('user123', 'free', 'key123');
    });

    it('returns 500 on DB error', async () => {
      mockKvEntry.findOne.mockImplementation(() => { throw new Error('fail'); });

      const req = makeRequest('POST', '/api/kv/counter/increment');
      const res = await incrementPost(req, { params: Promise.resolve({ key: 'counter' }) });
      const { status } = await parseResponse(res);

      expect(status).toBe(500);
    });
  });
});
