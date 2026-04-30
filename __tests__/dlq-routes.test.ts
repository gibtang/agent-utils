import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockValidateApiKey = vi.fn();
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
}));

const mockDeadLetter = {
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
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
  q.then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve);
  q.catch = () => q;
  return q;
}

vi.mock('@/models/DeadLetter', () => ({
  default: mockDeadLetter,
}));

// Mock fetch for retry route
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAuthResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true as const,
    apiKey: { _id: 'key123', userId: 'user123', name: 'test-key', tier: 'free', key: 'ak_test', ...overrides },
  };
}

function makeRequest(method: string, path: string, body?: unknown) {
  const url = `http://localhost:3000${path}`;
  const init: RequestInit = { method, headers: { 'x-api-key': 'ak_test' } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  return new NextRequest(url, init);
}

async function parseResponse(response: Response) {
  return { status: response.status, body: await response.json() };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DLQ Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
  });

  // ── POST /api/dlq ──────────────────────────────────────────────────────

  describe('POST /api/dlq (capture)', () => {
    let dlqPost: typeof import('@/app/api/dlq/route').POST;

    beforeAll(async () => {
      ({ POST: dlqPost } = await import('@/app/api/dlq/route'));
    });

    it('creates a dead letter entry', async () => {
      mockDeadLetter.create.mockResolvedValue({
        _id: 'dl1', status: 'pending', createdAt: new Date(),
      });

      const res = await dlqPost(makeRequest('POST', '/api/dlq', {
        taskType: 'email', error: 'SMTP timeout', payload: { to: 'a@b.com' },
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.id).toBe('dl1');
      expect(body.data.status).toBe('pending');
    });

    it('rejects missing taskType', async () => {
      const res = await dlqPost(makeRequest('POST', '/api/dlq', { error: 'fail' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects missing error', async () => {
      const res = await dlqPost(makeRequest('POST', '/api/dlq', { taskType: 'email' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('defaults agentName to "unknown"', async () => {
      mockDeadLetter.create.mockResolvedValue({ _id: 'dl2', status: 'pending', createdAt: new Date() });

      await dlqPost(makeRequest('POST', '/api/dlq', { taskType: 't', error: 'e' }));
      expect(mockDeadLetter.create).toHaveBeenCalledWith(
        expect.objectContaining({ agentName: 'unknown' }),
      );
    });

    it('returns 500 on DB error', async () => {
      mockDeadLetter.create.mockImplementation(() => { throw new Error('fail'); });
      const res = await dlqPost(makeRequest('POST', '/api/dlq', { taskType: 't', error: 'e' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(500);
    });
  });

  // ── GET /api/dlq ───────────────────────────────────────────────────────

  describe('GET /api/dlq (list)', () => {
    let dlqGet: typeof import('@/app/api/dlq/route').GET;

    beforeAll(async () => {
      ({ GET: dlqGet } = await import('@/app/api/dlq/route'));
    });

    it('returns paginated list', async () => {
      const items = [{ _id: 'dl1', taskType: 'email', status: 'pending' }];
      mockDeadLetter.find.mockReturnValue(chainableQuery(items));
      mockDeadLetter.countDocuments.mockResolvedValue(1);

      const res = await dlqGet(makeRequest('GET', '/api/dlq?limit=10&offset=0'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.total).toBe(1);
    });

    it('filters by status and agent', async () => {
      mockDeadLetter.find.mockReturnValue(chainableQuery([]));
      mockDeadLetter.countDocuments.mockResolvedValue(0);

      await dlqGet(makeRequest('GET', '/api/dlq?status=pending&agent=bot1'));

      expect(mockDeadLetter.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', agentName: 'bot1' }),
      );
    });

    it('clamps limit to 100', async () => {
      mockDeadLetter.find.mockReturnValue(chainableQuery([]));
      mockDeadLetter.countDocuments.mockResolvedValue(0);

      const res = await dlqGet(makeRequest('GET', '/api/dlq?limit=999'));
      const { body } = await parseResponse(res);
      expect(body.data.limit).toBe(100);
    });
  });

  // ── GET /api/dlq/:id ───────────────────────────────────────────────────

  describe('GET /api/dlq/:id', () => {
    let idGet: typeof import('@/app/api/dlq/[id]/route').GET;

    beforeAll(async () => {
      ({ GET: idGet } = await import('@/app/api/dlq/[id]/route'));
    });

    it('returns full dead letter with payload', async () => {
      const item = { _id: 'dl1', taskType: 'email', payload: { to: 'a@b.com' }, error: 'timeout' };
      mockDeadLetter.findOne.mockResolvedValue(item);

      const res = await idGet(makeRequest('GET', '/api/dlq/dl1'), { params: Promise.resolve({ id: 'dl1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.payload).toEqual({ to: 'a@b.com' });
    });

    it('returns 404 when not found', async () => {
      mockDeadLetter.findOne.mockResolvedValue(null);
      const res = await idGet(makeRequest('GET', '/api/dlq/missing'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });

    it('scopes to userId', async () => {
      mockDeadLetter.findOne.mockResolvedValue(null);
      await idGet(makeRequest('GET', '/api/dlq/dl1'), { params: Promise.resolve({ id: 'dl1' }) });
      expect(mockDeadLetter.findOne).toHaveBeenCalledWith({ _id: 'dl1', userId: 'user123' });
    });
  });

  // ── DELETE /api/dlq/:id ────────────────────────────────────────────────

  describe('DELETE /api/dlq/:id (dismiss)', () => {
    let idDelete: typeof import('@/app/api/dlq/[id]/route').DELETE;

    beforeAll(async () => {
      ({ DELETE: idDelete } = await import('@/app/api/dlq/[id]/route'));
    });

    it('dismisses a dead letter (sets status to dismissed)', async () => {
      mockDeadLetter.findOneAndUpdate.mockResolvedValue({ _id: 'dl1', status: 'dismissed' });

      const res = await idDelete(makeRequest('DELETE', '/api/dlq/dl1'), { params: Promise.resolve({ id: 'dl1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.status).toBe('dismissed');
      expect(mockDeadLetter.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'dl1', userId: 'user123' },
        { status: 'dismissed' },
        { new: true },
      );
    });

    it('returns 404 when not found', async () => {
      mockDeadLetter.findOneAndUpdate.mockResolvedValue(null);
      const res = await idDelete(makeRequest('DELETE', '/api/dlq/missing'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });
  });

  // ── POST /api/dlq/:id/retry ────────────────────────────────────────────

  describe('POST /api/dlq/:id/retry', () => {
    let retryPost: typeof import('@/app/api/dlq/[id]/retry/route').POST;

    beforeAll(async () => {
      ({ POST: retryPost } = await import('@/app/api/dlq/[id]/retry/route'));
    });

    it('retries via webhook and updates status', async () => {
      const item = {
        _id: 'dl1', retryWebhook: 'https://example.com/retry', taskType: 'email',
        payload: { to: 'a@b.com' }, error: 'timeout', retryCount: 0,
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockDeadLetter.findOne.mockResolvedValue(item);
      mockFetch.mockResolvedValue({ status: 200, ok: true });

      const res = await retryPost(makeRequest('POST', '/api/dlq/dl1/retry'), { params: Promise.resolve({ id: 'dl1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.status).toBe('retried');
      expect(body.data.retryCount).toBe(1);
      expect(item.save).toHaveBeenCalled();
    });

    it('rejects retry when no webhook configured', async () => {
      mockDeadLetter.findOne.mockResolvedValue({ _id: 'dl1', retryWebhook: null });

      const res = await retryPost(makeRequest('POST', '/api/dlq/dl1/retry'), { params: Promise.resolve({ id: 'dl1' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('returns 404 when not found', async () => {
      mockDeadLetter.findOne.mockResolvedValue(null);
      const res = await retryPost(makeRequest('POST', '/api/dlq/missing/retry'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });
  });
});
