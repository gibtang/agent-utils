/**
 * Card 3 (8330): KV Store MVP — CAS, TTL, prefix listing, namespace isolation.
 * Covers KV-001..KV-012 and namespace rules R-KV-1..9.
 */
import { describe, it, expect } from 'vitest';
import { GET as kvGet, PUT as kvPut, DELETE as kvDelete } from '@/app/v1/kv/[namespace]/[[...key]]/route';
import {
  call,
  agentHeaders,
  makeAgent,
  makeTenant,
} from './_helpers';

const put = (agent: { agentId: string; apiKey: string }, ns: string, key: string[], body: unknown, headers: Record<string, string> = {}) =>
  call(kvPut, 'PUT', `/v1/kv/${ns}/${key.join('/')}`, { body, headers: { ...agentHeaders(agent.agentId, agent.apiKey), ...headers }, params: { namespace: ns, key } });
const get = (agent: { agentId: string; apiKey: string }, ns: string, key: string[]) =>
  call(kvGet, 'GET', `/v1/kv/${ns}/${key.join('/')}`, { headers: agentHeaders(agent.agentId, agent.apiKey), params: { namespace: ns, key } });
const list = (agent: { agentId: string; apiKey: string }, ns: string, query = '') =>
  call(kvGet, 'GET', `/v1/kv/${ns}${query}`, { headers: agentHeaders(agent.agentId, agent.apiKey), params: { namespace: ns } });
const del = (agent: { agentId: string; apiKey: string }, ns: string, key: string[]) =>
  call(kvDelete, 'DELETE', `/v1/kv/${ns}/${key.join('/')}`, { headers: agentHeaders(agent.agentId, agent.apiKey), params: { namespace: ns, key } });

describe('Card 3 — KV Store', () => {
  it('KV-001: PUT then GET round-trips the value; version=1', async () => {
    const t = await makeTenant({ name: 'kv1' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await put(a, 'rx0', ['mykey'], { value: 'hello' });
    expect(r.status).toBe(200);
    expect(r.body.data.version).toBe(1);
    const g = await get(a, 'rx0', ['mykey']);
    expect(g.status).toBe(200);
    expect(g.body.data.value).toBe('hello');
  });

  it('KV-002: missing key returns 404 KEY_NOT_FOUND', async () => {
    const t = await makeTenant({ name: 'kv2' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await get(a, 'rx0', ['missing']);
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('KEY_NOT_FOUND');
  });

  it('KV-003: expired TTL returns 404 KEY_NOT_FOUND', async () => {
    const t = await makeTenant({ name: 'kv3' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await put(a, 'rx0', ['short'], { value: 'gone', ttl_seconds: 1 });
    await new Promise((r) => setTimeout(r, 1300));
    const r = await get(a, 'rx0', ['short']);
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('KEY_NOT_FOUND');
  });

  it('KV-004: CAS with matching version succeeds and increments version', async () => {
    const t = await makeTenant({ name: 'kv4' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await put(a, 'rx0', ['k'], { value: 'v1' });
    const atV1 = await get(a, 'rx0', ['k']);
    expect(atV1.body.data.version).toBe(1);
    const r = await put(a, 'rx0', ['k'], { value: 'v2' }, { 'if-match': '1' });
    expect(r.status).toBe(200);
    expect(r.body.data.version).toBe(2);
  });

  it('KV-005: CAS with wrong version returns 409 VERSION_MISMATCH', async () => {
    const t = await makeTenant({ name: 'kv5' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await put(a, 'rx0', ['k'], { value: 'v1' });
    const r = await put(a, 'rx0', ['k'], { value: 'v2' }, { 'if-match': '99' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('VERSION_MISMATCH');
    expect(r.body.error.details.current_version).toBe(1);
  });

  it('KV-006: If-Match: 0 on missing key creates it (create-only guard)', async () => {
    const t = await makeTenant({ name: 'kv6' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await put(a, 'rx0', ['fresh'], { value: 'first' }, { 'if-match': '0' });
    expect(r.status).toBe(200);
    expect(r.body.data.version).toBe(1);
  });

  it('KV-006b: If-Match: 0 on existing key returns 409 CONFLICT', async () => {
    const t = await makeTenant({ name: 'kv6b' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await put(a, 'rx0', ['k'], { value: 'v1' });
    const r = await put(a, 'rx0', ['k'], { value: 'v2' }, { 'if-match': '0' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT');
  });

  it('KV-007: agent cannot read another agent private namespace (403 NAMESPACE_FORBIDDEN)', async () => {
    const t = await makeTenant({ name: 'kv7' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const b = await makeAgent(t.tenantId, 'qa');
    await put(a, 'rx0', ['secret'], { value: 'x' });
    const r = await get(b, 'rx0', ['secret']);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NAMESPACE_FORBIDDEN');
  });

  it('KV-008: two agents write shared without CAS — both succeed, last wins', async () => {
    const t = await makeTenant({ name: 'kv8' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const b = await makeAgent(t.tenantId, 'qa');
    const r1 = await put(a, 'shared', ['build-status'], { value: 'a' });
    const r2 = await put(b, 'shared', ['build-status'], { value: 'b' });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const g = await get(a, 'shared', ['build-status']);
    expect(g.body.data.value).toBe('b');
  });

  it('KV-009: two agents CAS on shared key — exactly one wins', async () => {
    const t = await makeTenant({ name: 'kv9' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const b = await makeAgent(t.tenantId, 'qa');
    await put(a, 'shared', ['cas'], { value: 'v1' });
    const [r1, r2] = await Promise.all([
      put(a, 'shared', ['cas'], { value: 'a' }, { 'if-match': '1' }),
      put(b, 'shared', ['cas'], { value: 'b' }, { 'if-match': '1' }),
    ]);
    const ok = [r1, r2].filter((r) => r.status === 200);
    const conflict = [r1, r2].filter((r) => r.status === 409);
    expect(ok.length).toBe(1);
    expect(conflict.length).toBe(1);
    expect(conflict[0].body.error.code).toBe('VERSION_MISMATCH');
  });

  it('KV-010: value >100KB returns 413 PAYLOAD_TOO_LARGE', async () => {
    const t = await makeTenant({ name: 'kv10' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const big = 'x'.repeat(101 * 1024);
    const r = await put(a, 'rx0', ['big'], { value: big });
    expect(r.status).toBe(413);
  });

  it('KV-011: DELETE removes key; subsequent GET returns 404', async () => {
    const t = await makeTenant({ name: 'kv11' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await put(a, 'rx0', ['k'], { value: 'v' });
    const d = await del(a, 'rx0', ['k']);
    expect(d.status).toBe(204);
    const g = await get(a, 'rx0', ['k']);
    expect(g.status).toBe(404);
  });

  it('KV-012: unauthenticated returns 401 MISSING_AUTH_HEADERS', async () => {
    const t = await makeTenant({ name: 'kv12' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await put(a, 'rx0', ['k'], { value: 'v' });
    const r = await call(kvGet, 'GET', '/v1/kv/rx0/k', { params: { namespace: 'rx0', key: ['k'] } });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('MISSING_AUTH_HEADERS');
  });

  it('list returns key names + metadata, no values', async () => {
    const t = await makeTenant({ name: 'kvl' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await put(a, 'rx0', ['job:1'], { value: 'a' });
    await put(a, 'rx0', ['job:2'], { value: 'b' });
    await put(a, 'rx0', ['other'], { value: 'c' });
    const r = await list(a, 'rx0', '?prefix=job:');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data.length).toBe(2);
    expect(r.body.data.every((d: any) => d.value === undefined)).toBe(true);
    expect(r.body.data.some((d: any) => d.key === 'job:1')).toBe(true);
  });

  it('MT-001: shared namespace is per-tenant isolated', async () => {
    const tA = await makeTenant({ name: 'mt1a' });
    const tB = await makeTenant({ name: 'mt1b' });
    const aA = await makeAgent(tA.tenantId, 'rx0');
    const aB = await makeAgent(tB.tenantId, 'rx0');
    await put(aA, 'shared', ['cursor'], { value: 'A-value' });
    await put(aB, 'shared', ['cursor'], { value: 'B-value' });
    const fromB = await get(aB, 'shared', ['cursor']);
    expect(fromB.body.data.value).toBe('B-value');
    const fromA = await get(aA, 'shared', ['cursor']);
    expect(fromA.body.data.value).toBe('A-value');
  });

  it('MT-005 (KV variant): cross-tenant private key guess returns 404, not 403', async () => {
    const tA = await makeTenant({ name: 'mt5a' });
    const tB = await makeTenant({ name: 'mt5b' });
    const aA = await makeAgent(tA.tenantId, 'rx0');
    const aB = await makeAgent(tB.tenantId, 'rx0');
    await put(aA, 'rx0', ['secret'], { value: 'A' });
    // Tenant B's rx0 reads its OWN namespace rx0 — key doesn't exist for B → 404
    const r = await get(aB, 'rx0', ['secret']);
    expect(r.status).toBe(404);
  });

  it('JSON null is a valid value', async () => {
    const t = await makeTenant({ name: 'kvnull' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await put(a, 'rx0', ['k'], { value: null });
    expect(r.status).toBe(200);
    const g = await get(a, 'rx0', ['k']);
    expect(g.body.data.value).toBeNull();
  });
});
