import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../helpers/mongodb';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockResendSend = vi.fn();
process.env.RESEND_API_KEY = 'test-key';
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function(this: { emails: { send: (...a: unknown[]) => unknown } }) {
    this.emails = { send: (...args: unknown[]) => mockResendSend(...args) };
  }),
}));

const mockValidateApiKey = vi.fn();
const mockIncrementQuota = vi.fn();

vi.mock('@/lib/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  authErrorResponse: (error: { error: string; statusCode: number }) =>
    new Response(JSON.stringify({ error: error.error, code: `HTTP_${error.statusCode}` }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    }),
  incrementQuota: (...args: unknown[]) => mockIncrementQuota(...args),
}));

const mockUserFindById = vi.fn();
vi.mock('@/models/User', () => ({
  default: { findById: (...args: unknown[]) => mockUserFindById(...args) },
}));

const mockNotificationCreate = vi.fn();
const mockNotificationFind = vi.fn();
const mockNotificationCountDocuments = vi.fn();
const mockNotificationFindOne = vi.fn();

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
  default: {
    create: (...args: unknown[]) => mockNotificationCreate(...args),
    find: (...args: unknown[]) => mockNotificationFind(...args),
    countDocuments: (...args: unknown[]) => mockNotificationCountDocuments(...args),
    findOne: (...args: unknown[]) => mockNotificationFindOne(...args),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body?: unknown) {
  const url = 'http://localhost:3000/api/notify';
  const init: RequestInit = { method: 'POST', headers: { 'x-api-key': 'ak_test' } };
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

describe('Resend Integration (SDK-verified mocks)', () => {
  let notifyPost: typeof import('@/app/api/notify/route').POST;

  beforeAll(async () => {
    ({ POST: notifyPost } = await import('@/app/api/notify/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({
      success: true,
      apiKey: { _id: 'key123', userId: 'user123', name: 'test-key', tier: 'free', key: 'ak_test' },
    });
    mockIncrementQuota.mockResolvedValue(undefined);
    mockResendSend.mockResolvedValue({ data: { id: 're_123' }, error: null });
    mockNotificationCreate.mockResolvedValue({ _id: 'n1' });
  });

  it('sends correct payload structure to Resend SDK', async () => {
    await notifyPost(makeRequest({
      to: 'user@example.com',
      subject: 'Test Subject',
      message: 'Hello world',
      priority: 'urgent',
    }));

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const payload = mockResendSend.mock.calls[0][0];

    // Verify the SDK call matches Resend's expected interface
    expect(payload.from).toBe('notify@www.agent-utils.com');
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toBe('Test Subject');
    expect(payload.html).toBeDefined();
    expect(typeof payload.html).toBe('string');
  });

  it('applies correct priority color styling', async () => {
    await notifyPost(makeRequest({ to: 'u@e.com', message: 'm', priority: 'urgent' }));
    const urgentHtml = mockResendSend.mock.calls[0][0].html;
    expect(urgentHtml).toContain('#ef4444'); // red

    mockResendSend.mockClear();
    await notifyPost(makeRequest({ to: 'u@e.com', message: 'm', priority: 'normal' }));
    const normalHtml = mockResendSend.mock.calls[0][0].html;
    expect(normalHtml).toContain('#3b82f6'); // blue

    mockResendSend.mockClear();
    await notifyPost(makeRequest({ to: 'u@e.com', message: 'm', priority: 'low' }));
    const lowHtml = mockResendSend.mock.calls[0][0].html;
    expect(lowHtml).toContain('#6b7280'); // gray
  });

  it('escapes HTML entities in message (XSS prevention)', async () => {
    await notifyPost(makeRequest({
      to: 'u@e.com',
      message: '<script>alert("xss")</script>&"quoted"',
    }));

    const html = mockResendSend.mock.calls[0][0].html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });

  it('includes metadata as JSON in HTML when provided', async () => {
    await notifyPost(makeRequest({
      to: 'u@e.com',
      message: 'Check this',
      metadata: { runId: 'abc-123', steps: 5 },
    }));

    const html = mockResendSend.mock.calls[0][0].html;
    expect(html).toContain('runId');
    expect(html).toContain('abc-123');
    expect(html).toContain('steps');
  });

  it('does not include metadata block when not provided', async () => {
    await notifyPost(makeRequest({ to: 'u@e.com', message: 'No meta' }));

    const html = mockResendSend.mock.calls[0][0].html;
    // The metadata <pre> block should not be present
    expect(html).not.toMatch(/<pre.*>{.*}<\/pre>/s);
  });

  it('defaults subject with urgent prefix when priority is urgent', async () => {
    await notifyPost(makeRequest({ to: 'u@e.com', message: 'm', priority: 'urgent' }));

    const payload = mockResendSend.mock.calls[0][0];
    expect(payload.subject).toContain('\u{1F6A8}'); // 🚨
  });

  it('logs notification with correct fields on success', async () => {
    await notifyPost(makeRequest({ to: 'u@e.com', subject: 'Hi', message: 'Hello' }));

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u@e.com',
        subject: 'Hi',
        message: 'Hello',
        status: 'sent',
        resendId: 're_123',
      }),
    );
  });

  it('logs notification as failed when Resend returns error', async () => {
    mockResendSend.mockResolvedValue({ data: null, error: { message: 'Rate limited' } });

    await notifyPost(makeRequest({ to: 'u@e.com', message: 'Hello' }));

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: 'Rate limited',
      }),
    );
  });

  it('logs notification as failed when Resend throws', async () => {
    mockResendSend.mockImplementation(() => { throw new Error('Network timeout'); });

    await notifyPost(makeRequest({ to: 'u@e.com', message: 'Hello' }));

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: 'Network timeout',
      }),
    );
  });

  it('falls back to user email when no "to" provided', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ email: 'fallback@test.com' }),
      }),
    });

    await notifyPost(makeRequest({ message: 'Hello' }));

    const payload = mockResendSend.mock.calls[0][0];
    expect(payload.to).toBe('fallback@test.com');
  });
});
