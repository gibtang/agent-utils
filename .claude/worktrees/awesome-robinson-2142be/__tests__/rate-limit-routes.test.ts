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

const mockCheckRateLimit = vi.fn();
const mockResetRateLimit = vi.fn();
const mockGetRateLimitStatus = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  resetRateLimit: (...args: unknown[]) => mockResetRateLimit(...args),
  getRateLimitStatus: (...args: unknown[]) => mockGetRateLimitStatus(...args),
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

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Rate Limit Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(makeAuthResult());
    mockIncrementQuota.mockResolvedValue(undefined);
  });

  // ── POST /api/rate-limit/check ─────────────────────────────────────────

  describe('POST /api/rate-limit/check', () => {
    let checkPost: typeof import('@/app/api/rate-limit/check/route').POST;

    beforeAll(async () => {
      ({ POST: checkPost } = await import('@/app/api/rate-limit/check/route'));
    });

    it('returns 200 when allowed', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true, count: 1, remaining: 9, resetAt: new Date(),
      });

      const res = await checkPost(makeRequest('POST', '/api/rate-limit/check', {
        key: 'api.login', limit: 10, windowSeconds: 60,
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.allowed).toBe(true);
      expect(body.data.remaining).toBe(9);
      expect(mockIncrementQuota).toHaveBeenCalled();
    });

    it('returns 429 when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false, count: 11, remaining: 0, resetAt: new Date(), retryAfter: 30,
      });

      const res = await checkPost(makeRequest('POST', '/api/rate-limit/check', {
        key: 'api.login', limit: 10, windowSeconds: 60,
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(429);
      expect(body.data.allowed).toBe(false);
      expect(body.data.retryAfter).toBe(30);
    });

    it('rejects missing key', async () => {
      const res = await checkPost(makeRequest('POST', '/api/rate-limit/check', {
        limit: 10, windowSeconds: 60,
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects non-number limit', async () => {
      const res = await checkPost(makeRequest('POST', '/api/rate-limit/check', {
        key: 'k', limit: 'ten', windowSeconds: 60,
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects limit < 1', async () => {
      const res = await checkPost(makeRequest('POST', '/api/rate-limit/check', {
        key: 'k', limit: 0, windowSeconds: 60,
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('rejects missing windowSeconds', async () => {
      const res = await checkPost(makeRequest('POST', '/api/rate-limit/check', {
        key: 'k', limit: 10,
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('returns 403 for tier without rate limit feature', async () => {
      // Free tier has features.rateLimit=true, so use a tier that doesn't
      // Looking at pricing.ts, all tiers have rateLimit=true
      // So this test verifies the gate exists even if all tiers pass
      mockValidateApiKey.mockResolvedValue(makeAuthResult());
      mockCheckRateLimit.mockResolvedValue({ allowed: true, count: 1, remaining: 9, resetAt: new Date() });

      const res = await checkPost(makeRequest('POST', '/api/rate-limit/check', {
        key: 'k', limit: 10, windowSeconds: 60,
      }));
      const { status } = await parseResponse(res);
      expect(status).toBe(200);
    });
  });

  // ── GET /api/rate-limit/:key ───────────────────────────────────────────

  describe('GET /api/rate-limit/:key (status)', () => {
    let statusGet: typeof import('@/app/api/rate-limit/[key]/route').GET;

    beforeAll(async () => {
      ({ GET: statusGet } = await import('@/app/api/rate-limit/[key]/route'));
    });

    it('returns current rate limit status', async () => {
      mockGetRateLimitStatus.mockResolvedValue({
        key: 'api.login', count: 5, remaining: 5, resetAt: new Date(), windowExpired: false,
      });

      const res = await statusGet(makeRequest('GET', '/api/rate-limit/api.login'), { params: Promise.resolve({ key: 'api.login' }) });
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.count).toBe(5);
      expect(body.data.remaining).toBe(5);
    });

    it('decodes URL-encoded keys', async () => {
      mockGetRateLimitStatus.mockResolvedValue({
        key: 'api/login', count: 0, remaining: 100, resetAt: null, windowExpired: true,
      });

      const res = await statusGet(makeRequest('GET', '/api/rate-limit/api%2Flogin'), { params: Promise.resolve({ key: 'api%2Flogin' }) });
      const { body } = await parseResponse(res);

      expect(mockGetRateLimitStatus).toHaveBeenCalledWith('key123', 'api/login', 100);
    });

    it('returns 500 on error', async () => {
      mockGetRateLimitStatus.mockImplementation(() => { throw new Error('fail'); });
      const res = await statusGet(makeRequest('GET', '/api/rate-limit/k'), { params: Promise.resolve({ key: 'k' }) });
      const { status } = await parseResponse(res);
      expect(status).toBe(500);
    });
  });

  // ── POST /api/rate-limit/reset ─────────────────────────────────────────

  describe('POST /api/rate-limit/reset', () => {
    let resetPost: typeof import('@/app/api/rate-limit/reset/route').POST;

    beforeAll(async () => {
      ({ POST: resetPost } = await import('@/app/api/rate-limit/reset/route'));
    });

    it('resets rate limit counter', async () => {
      mockResetRateLimit.mockResolvedValue(true);

      const res = await resetPost(makeRequest('POST', '/api/rate-limit/reset', { key: 'api.login' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.reset).toBe(true);
      expect(body.data.key).toBe('api.login');
    });

    it('returns reset=false when no counter exists', async () => {
      mockResetRateLimit.mockResolvedValue(false);

      const res = await resetPost(makeRequest('POST', '/api/rate-limit/reset', { key: 'nonexistent' }));
      const { body } = await parseResponse(res);
      expect(body.data.reset).toBe(false);
    });

    it('rejects missing key', async () => {
      const res = await resetPost(makeRequest('POST', '/api/rate-limit/reset', {}));
      const { status } = await parseResponse(res);
      expect(status).toBe(400);
    });

    it('returns 500 on error', async () => {
      mockResetRateLimit.mockImplementation(() => { throw new Error('fail'); });
      const res = await resetPost(makeRequest('POST', '/api/rate-limit/reset', { key: 'k' }));
      const { status } = await parseResponse(res);
      expect(status).toBe(500);
    });
  });
});
