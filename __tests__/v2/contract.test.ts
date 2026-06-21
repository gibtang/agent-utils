/**
 * Card 2 (832d): shared API contract — envelope, request_id, cursor pagination,
 * rate-limit headers, quota errors (429 QUOTA_EXCEEDED), idempotency across
 * every creation endpoint.
 */
import { describe, it, expect } from 'vitest';
import { POST as createTenant } from '@/app/v1/tenants/route';
import { GET as getTenant } from '@/app/v1/tenants/[id]/route';
import { POST as createAgent } from '@/app/v1/agents/route';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';
import {
  call,
  adminHeaders,
  makeTenant,
} from './_helpers';

describe('Card 2 — shared API contract', () => {
  describe('Response envelope', () => {
    it('single-resource success uses { data, meta: { request_id } }', async () => {
      const t = await makeTenant({ name: 'env1' });
      const res = await call(getTenant, 'GET', `/v1/tenants/${t.tenantId}`, {
        params: { id: t.tenantId },
        headers: adminHeaders(t.adminKey),
      });
      expect(res.body.data).toBeTruthy();
      expect(res.body.meta.request_id).toMatch(/^req_/);
      expect(res.body.data.tenant_id).toBe(t.tenantId);
    });

    it('every response carries x-request-id header and rate-limit headers', async () => {
      const t = await makeTenant({ name: 'env2' });
      const res = await call(getTenant, 'GET', `/v1/tenants/${t.tenantId}`, {
        params: { id: t.tenantId },
        headers: adminHeaders(t.adminKey),
      });
      expect(res.headers.get('x-request-id')).toMatch(/^req_/);
      expect(Number(res.headers.get('X-RateLimit-Limit'))).toBeGreaterThan(0);
      expect(Number(res.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0);
    });

    it('error envelope is { error: { code, message, details?, request_id } }', async () => {
      const res = await call(getTenant, 'GET', `/v1/tenants/ten_does_not_exist`, {
        params: { id: 'ten_does_not_exist' },
        headers: { 'x-admin-key': 'agutil_adm_deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toMatch(/INVALID_CREDENTIALS|MISSING_AUTH_HEADERS/);
      expect(res.body.error.request_id).toMatch(/^req_/);
    });
  });

  describe('Cursor pagination helpers', () => {
    it('encodes and decodes a cursor round-trip', () => {
      const c = encodeCursor({ _id: 'abc', ts: '2025-01-01T00:00:00Z' });
      const back = decodeCursor(c);
      expect(back?._id).toBe('abc');
      expect(back?.ts).toBe('2025-01-01T00:00:00Z');
    });

    it('clampLimit respects defaults and max', () => {
      expect(clampLimit(undefined, 20, 100)).toBe(20);
      expect(clampLimit('5', 20, 100)).toBe(5);
      expect(clampLimit('500', 20, 100)).toBe(100);
      expect(clampLimit('-3', 20, 100)).toBe(20);
    });
  });

  describe('Rate limits', () => {
    it('rate-limit headers reflect free plan (60/min) and decrement remaining', async () => {
      const t = await makeTenant({ name: 'rl1' });
      const r1 = await call(getTenant, 'GET', `/v1/tenants/${t.tenantId}`, {
        params: { id: t.tenantId }, headers: adminHeaders(t.adminKey),
      });
      const r2 = await call(getTenant, 'GET', `/v1/tenants/${t.tenantId}`, {
        params: { id: t.tenantId }, headers: adminHeaders(t.adminKey),
      });
      expect(Number(r1.headers.get('X-RateLimit-Limit'))).toBe(60);
      expect(Number(r2.headers.get('X-RateLimit-Remaining'))).toBeLessThan(Number(r1.headers.get('X-RateLimit-Remaining')));
    });
  });

  describe('Quota errors return 429 QUOTA_EXCEEDED (not 422)', () => {
    it('over-quota agent creation returns 429 with details.quota', async () => {
      const t = await makeTenant({ name: 'q1' });
      for (const n of ['agent-a', 'agent-b', 'agent-c']) {
        const r = await call(createAgent, 'POST', '/v1/agents', { headers: adminHeaders(t.adminKey), body: { name: n } });
        expect(r.status).toBe(201);
      }
      const over = await call(createAgent, 'POST', '/v1/agents', { headers: adminHeaders(t.adminKey), body: { name: 'agent-d' } });
      expect(over.status).toBe(429);
      expect(over.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(over.body.error.details.quota).toBe('agents');
    });
  });

  describe('Idempotency-Key across creation endpoints', () => {
    it('tenants: same key+body replays original; different body → 409 CONFLICT', async () => {
      const r1 = await call(createTenant, 'POST', '/v1/tenants', {
        body: { name: 'id-1', owner_email: 'a@b.com', plan: 'free' },
        headers: { 'idempotency-key': 'key-A' },
      });
      const r2 = await call(createTenant, 'POST', '/v1/tenants', {
        body: { name: 'id-1', owner_email: 'a@b.com', plan: 'free' },
        headers: { 'idempotency-key': 'key-A' },
      });
      expect(r2.status).toBe(201);
      expect(r2.body.data.tenant_id).toBe(r1.body.data.tenant_id);

      const r3 = await call(createTenant, 'POST', '/v1/tenants', {
        body: { name: 'id-1-z', owner_email: 'a@b.com', plan: 'free' },
        headers: { 'idempotency-key': 'key-A' },
      });
      expect(r3.status).toBe(409);
      expect(r3.body.error.code).toBe('CONFLICT');
    });

    it('agents: idempotent replay preserves api_key and agent_id', async () => {
      const t = await makeTenant({ name: 'id-2' });
      const r1 = await call(createAgent, 'POST', '/v1/agents', {
        headers: { ...adminHeaders(t.adminKey), 'idempotency-key': 'key-B' },
        body: { name: 'agent-rx' },
      });
      const r2 = await call(createAgent, 'POST', '/v1/agents', {
        headers: { ...adminHeaders(t.adminKey), 'idempotency-key': 'key-B' },
        body: { name: 'agent-rx' },
      });
      expect(r2.body.data.agent_id).toBe(r1.body.data.agent_id);
      expect(r2.body.data.api_key).toBe(r1.body.data.api_key);
    });
  });

  describe('HTTP status codes', () => {
    it('201 on creation, 200 on read, 400 on validation, 401 on auth', async () => {
      const created = await call(createTenant, 'POST', '/v1/tenants', {
        body: { name: 'st-1', owner_email: 'a@b.com', plan: 'free' },
      });
      expect(created.status).toBe(201);

      const t = await makeTenant({ name: 'st-2' });
      const read = await call(getTenant, 'GET', `/v1/tenants/${t.tenantId}`, {
        params: { id: t.tenantId }, headers: adminHeaders(t.adminKey),
      });
      expect(read.status).toBe(200);

      const bad = await call(createTenant, 'POST', '/v1/tenants', {
        body: { name: 'X', owner_email: 'bad', plan: 'free' },
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('VALIDATION_ERROR');

      const unauth = await call(getTenant, 'GET', `/v1/tenants/${t.tenantId}`, {
        params: { id: t.tenantId },
      });
      expect(unauth.status).toBe(401);
    });
  });
});
