import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

const mockAgentForm = {
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  create: vi.fn(),
  findByIdAndDelete: vi.fn(),
};

const mockFormResponse = {
  find: vi.fn(),
  deleteMany: vi.fn(),
};

function chainableQuery(resolvedValue: unknown) {
  const q: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(resolvedValue),
  };
  q.then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve);
  q.catch = () => q;
  return q;
}

vi.mock('@/models/AgentForm', () => ({
  default: mockAgentForm,
}));
vi.mock('@/models/FormResponse', () => ({
  default: mockFormResponse,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAuthResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true as const,
    apiKey: { _id: 'key123', userId: 'user123', name: 'test-key', tier: 'builder', key: 'ak_test', ...overrides },
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

const validFields = [
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'msg', label: 'Message', type: 'textarea' },
];

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Form Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
    mockIncrementQuota.mockResolvedValue(undefined);
  });

  // ── POST /api/form ─────────────────────────────────────────────────────

  describe('POST /api/form (create)', () => {
    let formPost: typeof import('@/app/api/form/route').POST;

    beforeAll(async () => {
      ({ POST: formPost } = await import('@/app/api/form/route'));
    });

    it('creates a form', async () => {
      mockAgentForm.countDocuments.mockResolvedValue(0);
      mockAgentForm.create.mockResolvedValue({
        _id: 'f1', token: 'tok1', title: 'Contact', status: 'active',
      });

      const res = await formPost(makeRequest('POST', '/api/form', {
        title: 'Contact', fields: validFields, webhookUrl: 'https://example.com/hook',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.token).toBe('tok1');
      expect(body.data.url).toContain('/f/tok1');
      expect(mockIncrementQuota).toHaveBeenCalled();
    });

    it('rejects missing title', async () => {
      const res = await formPost(makeRequest('POST', '/api/form', {
        fields: validFields, webhookUrl: 'https://example.com/hook',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects empty fields array', async () => {
      const res = await formPost(makeRequest('POST', '/api/form', {
        title: 'T', fields: [], webhookUrl: 'https://example.com/hook',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects invalid field type', async () => {
      const res = await formPost(makeRequest('POST', '/api/form', {
        title: 'T',
        fields: [{ name: 'x', label: 'X', type: 'color' }],
        webhookUrl: 'https://example.com/hook',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects field missing name', async () => {
      const res = await formPost(makeRequest('POST', '/api/form', {
        title: 'T',
        fields: [{ label: 'X', type: 'text' }],
        webhookUrl: 'https://example.com/hook',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects missing webhookUrl', async () => {
      const res = await formPost(makeRequest('POST', '/api/form', {
        title: 'T', fields: validFields,
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects when form limit reached', async () => {
      mockAgentForm.countDocuments.mockResolvedValue(25); // builder = 25

      const res = await formPost(makeRequest('POST', '/api/form', {
        title: 'T', fields: validFields, webhookUrl: 'https://example.com/hook',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(429);
    });

    it('accepts all valid field types', async () => {
      mockAgentForm.countDocuments.mockResolvedValue(0);
      mockAgentForm.create.mockResolvedValue({ _id: 'f2', token: 'tok2', title: 'T', status: 'active' });

      const allFields = ['text', 'email', 'number', 'textarea', 'select', 'checkbox'].map((type, i) => ({
        name: `f${i}`, label: `Field ${i}`, type,
      }));

      const res = await formPost(makeRequest('POST', '/api/form', {
        title: 'All', fields: allFields, webhookUrl: 'https://example.com/hook',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(201);
    });
  });

  // ── GET /api/form ──────────────────────────────────────────────────────

  describe('GET /api/form (list)', () => {
    let formGet: typeof import('@/app/api/form/route').GET;

    beforeAll(async () => {
      ({ GET: formGet } = await import('@/app/api/form/route'));
    });

    it('returns forms with URLs and response counts', async () => {
      const items = [{ _id: 'f1', token: 'tok1', title: 'Contact', status: 'active', responseCount: 3, expiresAt: new Date() }];
      mockAgentForm.find.mockReturnValue(chainableQuery(items));
      mockAgentForm.countDocuments.mockResolvedValue(1);

      const res = await formGet(makeRequest('GET', '/api/form'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.items[0].url).toContain('/f/tok1');
      expect(body.data.items[0].responseCount).toBe(3);
    });
  });

  // ── GET /api/form/:id ──────────────────────────────────────────────────

  describe('GET /api/form/:id (detail)', () => {
    let idGet: typeof import('@/app/api/form/[id]/route').GET;

    beforeAll(async () => {
      ({ GET: idGet } = await import('@/app/api/form/[id]/route'));
    });

    it('returns form with responses', async () => {
      const form = { _id: 'f1', userId: 'user123', token: 'tok1', title: 'Contact', fields: validFields, webhookUrl: 'https://example.com/hook', status: 'active', responseCount: 1, expiresAt: new Date() };
      mockAgentForm.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(form) });
      const responses = [{ _id: 'r1', data: { email: 'a@b.com' }, sourceIp: '1.2.3.4', createdAt: new Date() }];
      mockFormResponse.find.mockReturnValue(chainableQuery(responses));

      const res = await idGet(makeRequest('GET', '/api/form/f1'), { params: Promise.resolve({ id: 'f1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.form.title).toBe('Contact');
      expect(body.data.responses).toHaveLength(1);
    });

    it('returns 404 when not found', async () => {
      mockAgentForm.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      const res = await idGet(makeRequest('GET', '/api/form/missing'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });
  });

  // ── DELETE /api/form/:id ───────────────────────────────────────────────

  describe('DELETE /api/form/:id', () => {
    let idDelete: typeof import('@/app/api/form/[id]/route').DELETE;

    beforeAll(async () => {
      ({ DELETE: idDelete } = await import('@/app/api/form/[id]/route'));
    });

    it('deletes form and all responses', async () => {
      const form = { _id: 'f1', userId: 'user123' };
      mockAgentForm.findOne.mockResolvedValue(form);
      mockFormResponse.deleteMany.mockResolvedValue({ deletedCount: 3 });
      mockAgentForm.findByIdAndDelete.mockResolvedValue(form);

      const res = await idDelete(makeRequest('DELETE', '/api/form/f1'), { params: Promise.resolve({ id: 'f1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.deleted).toBe(true);
      expect(mockFormResponse.deleteMany).toHaveBeenCalledWith({ formId: 'f1' });
    });

    it('returns 404 when not found', async () => {
      mockAgentForm.findOne.mockResolvedValue(null);
      const res = await idDelete(makeRequest('DELETE', '/api/form/missing'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });
  });
});
