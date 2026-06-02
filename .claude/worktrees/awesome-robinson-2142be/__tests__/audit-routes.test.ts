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

const mockAuditLog = {
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

vi.mock('@/models/AuditLog', () => ({
  default: mockAuditLog,
}));

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

describe('Audit Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
  });

  // ── POST /api/audit ────────────────────────────────────────────────────

  describe('POST /api/audit (log)', () => {
    let auditPost: typeof import('@/app/api/audit/route').POST;

    beforeAll(async () => {
      ({ POST: auditPost } = await import('@/app/api/audit/route'));
    });

    it('creates an audit log entry', async () => {
      mockAuditLog.create.mockResolvedValue({ _id: 'al1', createdAt: new Date() });

      const res = await auditPost(makeRequest('POST', '/api/audit', {
        action: 'file.delete', target: '/data/secret.csv', severity: 'warn',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.id).toBe('al1');
    });

    it('rejects missing action', async () => {
      const res = await auditPost(makeRequest('POST', '/api/audit', { agentName: 'bot' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects non-string action', async () => {
      const res = await auditPost(makeRequest('POST', '/api/audit', { action: 123 }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('defaults severity to "info"', async () => {
      mockAuditLog.create.mockResolvedValue({ _id: 'al2', createdAt: new Date() });

      await auditPost(makeRequest('POST', '/api/audit', { action: 'read' }));
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' }),
      );
    });

    it('defaults agentName to "unknown"', async () => {
      mockAuditLog.create.mockResolvedValue({ _id: 'al3', createdAt: new Date() });

      await auditPost(makeRequest('POST', '/api/audit', { action: 'read' }));
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ agentName: 'unknown' }),
      );
    });

    it('sets userId and apiKeyId from auth', async () => {
      mockAuditLog.create.mockResolvedValue({ _id: 'al4', createdAt: new Date() });

      await auditPost(makeRequest('POST', '/api/audit', { action: 'login' }));
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user123', apiKeyId: 'key123' }),
      );
    });
  });

  // ── GET /api/audit ─────────────────────────────────────────────────────

  describe('GET /api/audit (list)', () => {
    let auditGet: typeof import('@/app/api/audit/route').GET;

    beforeAll(async () => {
      ({ GET: auditGet } = await import('@/app/api/audit/route'));
    });

    it('returns paginated logs', async () => {
      const items = [{ _id: 'al1', action: 'read', severity: 'info' }];
      mockAuditLog.find.mockReturnValue(chainableQuery(items));
      mockAuditLog.countDocuments.mockResolvedValue(1);

      const res = await auditGet(makeRequest('GET', '/api/audit?limit=10'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.total).toBe(1);
    });

    it('filters by agent, action, severity', async () => {
      mockAuditLog.find.mockReturnValue(chainableQuery([]));
      mockAuditLog.countDocuments.mockResolvedValue(0);

      await auditGet(makeRequest('GET', '/api/audit?agent=bot1&action=read&severity=warn'));

      expect(mockAuditLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ agentName: 'bot1', action: 'read', severity: 'warn' }),
      );
    });

    it('filters by date range', async () => {
      mockAuditLog.find.mockReturnValue(chainableQuery([]));
      mockAuditLog.countDocuments.mockResolvedValue(0);

      await auditGet(makeRequest('GET', '/api/audit?startDate=2024-01-01&endDate=2024-12-31'));

      const filter = mockAuditLog.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filter.createdAt).toBeDefined();
      const dateFilter = filter.createdAt as Record<string, Date>;
      expect(dateFilter.$gte).toBeInstanceOf(Date);
      expect(dateFilter.$lte).toBeInstanceOf(Date);
    });

    it('clamps limit to 100', async () => {
      mockAuditLog.find.mockReturnValue(chainableQuery([]));
      mockAuditLog.countDocuments.mockResolvedValue(0);

      const res = await auditGet(makeRequest('GET', '/api/audit?limit=999'));
      const { body } = await parseResponse(res);
      expect(body.data.limit).toBe(100);
    });
  });

  // ── GET /api/audit/:id ─────────────────────────────────────────────────

  describe('GET /api/audit/:id', () => {
    let idGet: typeof import('@/app/api/audit/[id]/route').GET;

    beforeAll(async () => {
      ({ GET: idGet } = await import('@/app/api/audit/[id]/route'));
    });

    it('returns single audit log', async () => {
      const item = { _id: 'al1', action: 'delete', target: 'file.csv', metadata: { reason: 'expired' } };
      mockAuditLog.findOne.mockResolvedValue(item);

      const res = await idGet(makeRequest('GET', '/api/audit/al1'), { params: Promise.resolve({ id: 'al1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.action).toBe('delete');
    });

    it('returns 404 when not found', async () => {
      mockAuditLog.findOne.mockResolvedValue(null);
      const res = await idGet(makeRequest('GET', '/api/audit/missing'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });

    it('scopes to userId', async () => {
      mockAuditLog.findOne.mockResolvedValue(null);
      await idGet(makeRequest('GET', '/api/audit/al1'), { params: Promise.resolve({ id: 'al1' }) });
      expect(mockAuditLog.findOne).toHaveBeenCalledWith({ _id: 'al1', userId: 'user123' });
    });
  });
});
