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

// Mock Resend
const mockResendSend = vi.fn();
process.env.RESEND_API_KEY = 'test-key';
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function() {
    this.emails = { send: (...args: unknown[]) => mockResendSend(...args) };
  }),
}));

// Mock User model for email fallback
const mockUserFindById = vi.fn();
vi.mock('@/models/User', () => ({
  default: { findById: (...args: unknown[]) => mockUserFindById(...args) },
}));

const mockNotification = {
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
    limit: vi.fn().mockReturnThis(),
  };
  q.then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve);
  q.catch = () => q;
  return q;
}

vi.mock('@/models/Notification', () => ({
  default: mockNotification,
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

describe('Notify Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
    mockIncrementQuota.mockResolvedValue(undefined);
    mockResendSend.mockResolvedValue({ data: { id: 're_123' }, error: null });
  });

  // ── POST /api/notify ───────────────────────────────────────────────────

  describe('POST /api/notify (send)', () => {
    let notifyPost: typeof import('@/app/api/notify/route').POST;

    beforeAll(async () => {
      ({ POST: notifyPost } = await import('@/app/api/notify/route'));
    });

    it('sends notification and logs it', async () => {
      mockNotification.create.mockResolvedValue({ _id: 'n1' });

      const res = await notifyPost(makeRequest('POST', '/api/notify', {
        to: 'user@example.com', subject: 'Alert', message: 'Something happened',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.status).toBe('sent');
      expect(body.data.resendId).toBe('re_123');
      expect(mockResendSend).toHaveBeenCalled();
      expect(mockNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com', status: 'sent' }),
      );
    });

    it('rejects missing message', async () => {
      const res = await notifyPost(makeRequest('POST', '/api/notify', {
        to: 'user@example.com', subject: 'Hi',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('falls back to user email when no "to" provided', async () => {
      mockUserFindById.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ email: 'default@test.com' }) }) });
      mockNotification.create.mockResolvedValue({ _id: 'n2' });

      const res = await notifyPost(makeRequest('POST', '/api/notify', {
        message: 'Hello',
      }));
      const { body } = await parseResponse(res);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'default@test.com' }),
      );
    });

    it('handles Resend API failure gracefully', async () => {
      mockResendSend.mockResolvedValue({ data: null, error: { message: 'API key invalid' } });
      mockNotification.create.mockResolvedValue({ _id: 'n3' });

      const res = await notifyPost(makeRequest('POST', '/api/notify', {
        to: 'user@example.com', message: 'Hello',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(502);
      expect(body.data.status).toBe('failed');
    });

    it('handles Resend exception gracefully', async () => {
      mockResendSend.mockImplementation(() => { throw new Error('Network error'); });
      mockNotification.create.mockResolvedValue({ _id: 'n4' });

      const res = await notifyPost(makeRequest('POST', '/api/notify', {
        to: 'user@example.com', message: 'Hello',
      }));
      const { status } = await parseResponse(res);

      expect(status).toBe(502);
    });

    it('increments quota', async () => {
      mockNotification.create.mockResolvedValue({ _id: 'n5' });

      await notifyPost(makeRequest('POST', '/api/notify', {
        to: 'u@e.com', message: 'hi',
      }));

      expect(mockIncrementQuota).toHaveBeenCalledWith('user123', 'free', 'key123');
    });

    it('escapes HTML in message', async () => {
      mockNotification.create.mockResolvedValue({ _id: 'n6' });

      await notifyPost(makeRequest('POST', '/api/notify', {
        to: 'u@e.com', message: '<script>alert("xss")</script>',
      }));

      const sendCall = mockResendSend.mock.calls[0][0];
      expect(sendCall.html).not.toContain('<script>');
      expect(sendCall.html).toContain('&lt;script&gt;');
    });

    it('defaults subject when not provided', async () => {
      mockNotification.create.mockResolvedValue({ _id: 'n7' });

      await notifyPost(makeRequest('POST', '/api/notify', {
        to: 'u@e.com', message: 'hi',
      }));

      const sendCall = mockResendSend.mock.calls[0][0];
      expect(sendCall.subject).toContain('AgentUtils');
    });
  });

  // ── GET /api/notify ────────────────────────────────────────────────────

  describe('GET /api/notify (list)', () => {
    let notifyGet: typeof import('@/app/api/notify/route').GET;

    beforeAll(async () => {
      ({ GET: notifyGet } = await import('@/app/api/notify/route'));
    });

    it('returns paginated notification history', async () => {
      const items = [{ _id: 'n1', to: 'u@e.com', subject: 'Hi', status: 'sent' }];
      mockNotification.find.mockReturnValue(chainableQuery(items));
      mockNotification.countDocuments.mockResolvedValue(1);

      const res = await notifyGet(makeRequest('GET', '/api/notify'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.total).toBe(1);
    });

    it('filters by status and priority', async () => {
      mockNotification.find.mockReturnValue(chainableQuery([]));
      mockNotification.countDocuments.mockResolvedValue(0);

      await notifyGet(makeRequest('GET', '/api/notify?status=sent&priority=urgent'));

      expect(mockNotification.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent', priority: 'urgent' }),
      );
    });

    it('omits metadata in list view', async () => {
      mockNotification.find.mockReturnValue(chainableQuery([]));
      mockNotification.countDocuments.mockResolvedValue(0);

      await notifyGet(makeRequest('GET', '/api/notify'));

      // Verify .select('-metadata') was called
      expect(mockNotification.find().select).toHaveBeenCalledWith('-metadata');
    });

    it('increments quota on GET', async () => {
      mockNotification.find.mockReturnValue(chainableQuery([]));
      mockNotification.countDocuments.mockResolvedValue(0);

      await notifyGet(makeRequest('GET', '/api/notify'));
      expect(mockIncrementQuota).toHaveBeenCalled();
    });
  });

  // ── GET /api/notify/:id ────────────────────────────────────────────────

  describe('GET /api/notify/:id', () => {
    let idGet: typeof import('@/app/api/notify/[id]/route').GET;

    beforeAll(async () => {
      ({ GET: idGet } = await import('@/app/api/notify/[id]/route'));
    });

    it('returns single notification with full detail', async () => {
      const notif = { _id: 'n1', to: 'u@e.com', message: 'Hello', metadata: { key: 'val' } };
      mockNotification.findOne.mockResolvedValue(notif);

      const res = await idGet(makeRequest('GET', '/api/notify/n1'), { params: Promise.resolve({ id: 'n1' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.metadata).toEqual({ key: 'val' });
    });

    it('returns 404 when not found', async () => {
      mockNotification.findOne.mockResolvedValue(null);
      const res = await idGet(makeRequest('GET', '/api/notify/missing'), { params: Promise.resolve({ id: 'missing' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });

    it('scopes to userId', async () => {
      mockNotification.findOne.mockResolvedValue(null);
      await idGet(makeRequest('GET', '/api/notify/n1'), { params: Promise.resolve({ id: 'n1' }) });
      expect(mockNotification.findOne).toHaveBeenCalledWith({ _id: 'n1', userId: 'user123' });
    });
  });
});
