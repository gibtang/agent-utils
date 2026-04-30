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

const mockCheckpoint = {
  find: vi.fn(),
  findOne: vi.fn(),
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

vi.mock('@/models/Checkpoint', () => ({
  default: mockCheckpoint,
}));

// Mock fetch for resume webhook
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

describe('Checkpoint Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
    mockFetch.mockResolvedValue({ status: 200, ok: true });
  });

  // ── POST /api/checkpoint ───────────────────────────────────────────────

  describe('POST /api/checkpoint (create)', () => {
    let cpPost: typeof import('@/app/api/checkpoint/route').POST;

    beforeAll(async () => {
      ({ POST: cpPost } = await import('@/app/api/checkpoint/route'));
    });

    it('creates a checkpoint', async () => {
      mockCheckpoint.create.mockResolvedValue({
        _id: 'cp1', status: 'pending', taskDescription: 'Review file', expiresAt: new Date(),
      });

      const res = await cpPost(makeRequest('POST', '/api/checkpoint', {
        taskDescription: 'Review file', state: { step: 3 },
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.id).toBe('cp1');
      expect(body.data.status).toBe('pending');
      expect(body.data.pollUrl).toContain('/api/checkpoint/cp1');
    });

    it('rejects missing taskDescription', async () => {
      const res = await cpPost(makeRequest('POST', '/api/checkpoint', { state: {} }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects missing state', async () => {
      const res = await cpPost(makeRequest('POST', '/api/checkpoint', { taskDescription: 'T' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('defaults ttlHours to 24', async () => {
      mockCheckpoint.create.mockResolvedValue({
        _id: 'cp2', status: 'pending', taskDescription: 'T', expiresAt: new Date(),
      });

      await cpPost(makeRequest('POST', '/api/checkpoint', {
        taskDescription: 'T', state: {},
      }));

      const createArg = mockCheckpoint.create.mock.calls[0][0];
      const diff = createArg.expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('respects custom ttlHours', async () => {
      mockCheckpoint.create.mockResolvedValue({
        _id: 'cp3', status: 'pending', taskDescription: 'T', expiresAt: new Date(),
      });

      await cpPost(makeRequest('POST', '/api/checkpoint', {
        taskDescription: 'T', state: {}, ttlHours: 48,
      }));

      const createArg = mockCheckpoint.create.mock.calls[0][0];
      const diff = createArg.expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(47 * 60 * 60 * 1000);
    });
  });

  // ── GET /api/checkpoint ────────────────────────────────────────────────

  describe('GET /api/checkpoint (list)', () => {
    let cpGet: typeof import('@/app/api/checkpoint/route').GET;

    beforeAll(async () => {
      ({ GET: cpGet } = await import('@/app/api/checkpoint/route'));
    });

    it('returns paginated list excluding state', async () => {
      const items = [{ _id: 'cp1', status: 'pending', taskDescription: 'Review' }];
      mockCheckpoint.find.mockReturnValue(chainableQuery(items));
      mockCheckpoint.countDocuments.mockResolvedValue(1);

      const res = await cpGet(makeRequest('GET', '/api/checkpoint'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.items).toHaveLength(1);
      // Verify .select('-state') was called
      expect(mockCheckpoint.find().select).toHaveBeenCalledWith('-state');
    });

    it('filters by status', async () => {
      mockCheckpoint.find.mockReturnValue(chainableQuery([]));
      mockCheckpoint.countDocuments.mockResolvedValue(0);

      await cpGet(makeRequest('GET', '/api/checkpoint?status=pending'));
      expect(mockCheckpoint.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });
  });

  // ── GET /api/checkpoint/:id ────────────────────────────────────────────

  describe('GET /api/checkpoint/:id (poll)', () => {
    let idGet: typeof import('@/app/api/checkpoint/[id]/route').GET;

    beforeAll(async () => {
      ({ GET: idGet } = await import('@/app/api/checkpoint/[id]/route'));
    });

    it('returns checkpoint details', async () => {
      const cp = {
        _id: 'cp1', status: 'pending', taskDescription: 'Review',
        agentName: 'bot', reviewNote: null, reviewedAt: null,
        expiresAt: new Date(Date.now() + 3600000), state: { step: 3 },
      };
      mockCheckpoint.findOne.mockResolvedValue(cp);

      const res = await idGet(makeRequest('GET', '/api/checkpoint/cp1'), { params: Promise.resolve({ id: 'cp1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.status).toBe('pending');
      // state should be undefined when not approved
      expect(body.data.state).toBeUndefined();
    });

    it('includes state when approved', async () => {
      const cp = {
        _id: 'cp1', status: 'approved', taskDescription: 'Review',
        agentName: 'bot', reviewNote: 'looks good', reviewedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), state: { step: 3, data: 'result' },
      };
      mockCheckpoint.findOne.mockResolvedValue(cp);

      const res = await idGet(makeRequest('GET', '/api/checkpoint/cp1'), { params: Promise.resolve({ id: 'cp1' }) });
      const { body } = await parseResponse(res);

      expect(body.data.state).toEqual({ step: 3, data: 'result' });
    });

    it('auto-expires pending checkpoints past expiresAt', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const cp = {
        _id: 'cp1', status: 'pending', expiresAt: new Date(Date.now() - 1000),
        taskDescription: 'T', agentName: 'bot', reviewNote: null, reviewedAt: null,
        state: {}, save,
      };
      mockCheckpoint.findOne.mockResolvedValue(cp);

      const res = await idGet(makeRequest('GET', '/api/checkpoint/cp1'), { params: Promise.resolve({ id: 'cp1' }) });
      const { body } = await parseResponse(res);

      expect(cp.status).toBe('expired');
      expect(save).toHaveBeenCalled();
    });

    it('returns 404 when not found', async () => {
      mockCheckpoint.findOne.mockResolvedValue(null);
      const res = await idGet(makeRequest('GET', '/api/checkpoint/missing'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });
  });

  // ── POST /api/checkpoint/:id/resume ────────────────────────────────────

  describe('POST /api/checkpoint/:id/resume (approve/reject)', () => {
    let resumePost: typeof import('@/app/api/checkpoint/[id]/resume/route').POST;

    beforeAll(async () => {
      ({ POST: resumePost } = await import('@/app/api/checkpoint/[id]/resume/route'));
    });

    it('approves a pending checkpoint', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const cp = {
        _id: 'cp1', status: 'pending', webhookUrl: null,
        state: { step: 3 }, save,
      };
      mockCheckpoint.findOne.mockResolvedValue(cp);

      const res = await resumePost(
        makeRequest('POST', '/api/checkpoint/cp1/resume', { action: 'approve', note: 'LGTM' }),
        { params: Promise.resolve({ id: 'cp1' }) },
      );
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.status).toBe('approved');
      expect(body.data.reviewedBy).toBe('test-key');
      expect(save).toHaveBeenCalled();
    });

    it('rejects a pending checkpoint', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const cp = { _id: 'cp1', status: 'pending', webhookUrl: null, save };
      mockCheckpoint.findOne.mockResolvedValue(cp);

      const res = await resumePost(
        makeRequest('POST', '/api/checkpoint/cp1/resume', { action: 'reject', note: 'bad' }),
        { params: Promise.resolve({ id: 'cp1' }) },
      );
      const { body } = await parseResponse(res);

      expect(body.data.status).toBe('rejected');
    });

    it('rejects invalid action', async () => {
      const res = await resumePost(
        makeRequest('POST', '/api/checkpoint/cp1/resume', { action: 'maybe' }),
        { params: Promise.resolve({ id: 'cp1' }) },
      );
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects already-processed checkpoint', async () => {
      mockCheckpoint.findOne.mockResolvedValue({ _id: 'cp1', status: 'approved', save: vi.fn() });

      const res = await resumePost(
        makeRequest('POST', '/api/checkpoint/cp1/resume', { action: 'approve' }),
        { params: Promise.resolve({ id: 'cp1' }) },
      );
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('fires webhook on approve', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const cp = {
        _id: 'cp1', status: 'pending', webhookUrl: 'https://example.com/wake',
        state: { data: 42 }, save,
      };
      mockCheckpoint.findOne.mockResolvedValue(cp);

      await resumePost(
        makeRequest('POST', '/api/checkpoint/cp1/resume', { action: 'approve' }),
        { params: Promise.resolve({ id: 'cp1' }) },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/wake',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns 404 when not found', async () => {
      mockCheckpoint.findOne.mockResolvedValue(null);
      const res = await resumePost(
        makeRequest('POST', '/api/checkpoint/missing/resume', { action: 'approve' }),
        { params: Promise.resolve({ id: 'missing' }) },
      );
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });
  });
});
