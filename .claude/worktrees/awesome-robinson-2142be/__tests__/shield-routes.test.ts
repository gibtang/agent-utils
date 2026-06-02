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

const mockPiiSession = {
  findOne: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/models/PiiSession', () => ({
  default: mockPiiSession,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAuthResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true as const,
    apiKey: { _id: 'key123', userId: 'user123', name: 'test-key', tier: 'pro', key: 'ak_test', ...overrides },
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

describe('Shield Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
    mockIncrementQuota.mockResolvedValue(undefined);
  });

  // ── GET /api/shield ────────────────────────────────────────────────────

  describe('GET /api/shield (info)', () => {
    let shieldGet: typeof import('@/app/api/shield/route').GET;

    beforeAll(async () => {
      ({ GET: shieldGet } = await import('@/app/api/shield/route'));
    });

    it('returns shield endpoint info', async () => {
      const res = await shieldGet();
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.endpoints.clean).toBeDefined();
      expect(body.data.endpoints.hydrate).toBeDefined();
      expect(body.data.supportedTypes).toContain('email');
      expect(body.data.supportedTypes).toContain('phone');
      expect(body.data.supportedTypes).toContain('ssn');
    });
  });

  // ── POST /api/shield/clean ─────────────────────────────────────────────

  describe('POST /api/shield/clean', () => {
    let cleanPost: typeof import('@/app/api/shield/clean/route').POST;

    beforeAll(async () => {
      ({ POST: cleanPost } = await import('@/app/api/shield/clean/route'));
    });

    it('detects and redacts email', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'Contact me at john@example.com please',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.cleaned).not.toContain('john@example.com');
      expect(body.data.cleaned).toContain('[EMAIL_1]');
      expect(body.data.detectionsFound).toBe(1);
    });

    it('detects and redacts phone number', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'Call me at 555-123-4567',
      }));
      const { body } = await parseResponse(res);

      expect(body.data.cleaned).not.toContain('555-123-4567');
      expect(body.data.cleaned).toContain('[PHONE_1]');
    });

    it('detects SSN pattern', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'SSN: 123-45-6789',
      }));
      const { body } = await parseResponse(res);

      expect(body.data.cleaned).not.toContain('123-45-6789');
      expect(body.data.detectionsFound).toBeGreaterThanOrEqual(1);
    });

    it('detects credit card pattern', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'Card: 4111-1111-1111-1111',
      }));
      const { body } = await parseResponse(res);

      expect(body.data.cleaned).not.toContain('4111-1111-1111-1111');
    });

    it('detects IP address', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'Server at 192.168.1.1 is down',
      }));
      const { body } = await parseResponse(res);

      expect(body.data.cleaned).not.toContain('192.168.1.1');
      expect(body.data.cleaned).toContain('[IP_1]');
    });

    it('detects multiple PII types in one text', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'Email: john@example.com, Phone: 555-123-4567',
      }));
      const { body } = await parseResponse(res);

      expect(body.data.detectionsFound).toBe(2);
      expect(body.data.types).toContain('EMAIL');
      expect(body.data.types).toContain('PHONE');
    });

    it('returns sessionId for later hydration', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'john@example.com',
      }));
      const { body } = await parseResponse(res);

      expect(body.data.sessionId).toBeDefined();
      expect(typeof body.data.sessionId).toBe('string');
    });

    it('returns 0 detections for clean text', async () => {
      mockPiiSession.create.mockResolvedValue({});

      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'Hello world, nothing sensitive here.',
      }));
      const { body } = await parseResponse(res);

      expect(body.data.detectionsFound).toBe(0);
      expect(body.data.cleaned).toBe('Hello world, nothing sensitive here.');
    });

    it('rejects missing text', async () => {
      const res = await cleanPost(makeRequest('POST', '/api/shield/clean', {}));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('stores mappings in session', async () => {
      mockPiiSession.create.mockResolvedValue({});

      await cleanPost(makeRequest('POST', '/api/shield/clean', {
        text: 'john@example.com',
      }));

      expect(mockPiiSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          apiKeyId: 'key123',
        }),
      );
      const createArg = mockPiiSession.create.mock.calls[0][0];
      expect(createArg.mappings).toBeInstanceOf(Map);
      expect(createArg.mappings.size).toBe(1);
    });
  });

  // ── POST /api/shield/hydrate ───────────────────────────────────────────

  describe('POST /api/shield/hydrate', () => {
    let hydratePost: typeof import('@/app/api/shield/hydrate/route').POST;

    beforeAll(async () => {
      ({ POST: hydratePost } = await import('@/app/api/shield/hydrate/route'));
    });

    it('restores original PII values', async () => {
      const mappings = new Map<string, string>();
      mappings.set('[EMAIL_1]', 'john@example.com');
      mappings.set('[PHONE_1]', '555-123-4567');
      mockPiiSession.findOne.mockResolvedValue({ mappings });

      const res = await hydratePost(makeRequest('POST', '/api/shield/hydrate', {
        sessionId: 'sess1', text: 'Contact [EMAIL_1] at [PHONE_1]',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.hydrated).toBe('Contact john@example.com at 555-123-4567');
      expect(body.data.replacementsMade).toBe(2);
    });

    it('rejects missing sessionId', async () => {
      const res = await hydratePost(makeRequest('POST', '/api/shield/hydrate', { text: 'hello' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects missing text', async () => {
      const res = await hydratePost(makeRequest('POST', '/api/shield/hydrate', { sessionId: 's1' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('returns 404 for expired/missing session', async () => {
      mockPiiSession.findOne.mockResolvedValue(null);

      const res = await hydratePost(makeRequest('POST', '/api/shield/hydrate', {
        sessionId: 'missing', text: '[EMAIL_1]',
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });

    it('scopes session to userId', async () => {
      mockPiiSession.findOne.mockResolvedValue(null);

      await hydratePost(makeRequest('POST', '/api/shield/hydrate', {
        sessionId: 's1', text: 'hello',
      }));

      expect(mockPiiSession.findOne).toHaveBeenCalledWith({
        _id: 's1',
        userId: 'user123',
      });
    });
  });
});
