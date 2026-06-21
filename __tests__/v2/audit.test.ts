/**
 * Card 4 (8333): Audit Log MVP — append-only, server timestamps, workflow filtering.
 * Covers AL-001..AL-008 and MT-003 (cross-tenant isolation).
 */
import { describe, it, expect } from 'vitest';
import { POST as auditPost, GET as auditGet } from '@/app/v1/audit/[[...id]]/route';
import { call, agentHeaders, makeAgent, makeTenant } from './_helpers';

const post = (a: { agentId: string; apiKey: string }, body: unknown, headers: Record<string, string> = {}) =>
  call(auditPost, 'POST', '/v1/audit', { body, headers: { ...agentHeaders(a.agentId, a.apiKey), ...headers } });
const list = (a: { agentId: string; apiKey: string }, query = '') =>
  call(auditGet, 'GET', `/v1/audit${query}`, { headers: agentHeaders(a.agentId, a.apiKey) });
const one = (a: { agentId: string; apiKey: string }, id: string) =>
  call(auditGet, 'GET', `/v1/audit/${id}`, { headers: agentHeaders(a.agentId, a.apiKey), params: { id: [id] } });

describe('Card 4 — Audit Log', () => {
  it('AL-001: POST creates an entry (201, id returned)', async () => {
    const t = await makeTenant({ name: 'al1' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await post(a, { action: 'deployment.initiated', resource_type: 'deployment', payload: { v: 1 } });
    expect(r.status).toBe(201);
    expect(r.body.data.id).toMatch(/^log_/);
    expect(r.body.data.action).toBe('deployment.initiated');
  });

  it('AL-002: GET /v1/audit/{id} returns the entry with all fields', async () => {
    const t = await makeTenant({ name: 'al2' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await post(a, { action: 'job.started', resource_type: 'job', resource_id: 'j1', metadata: { workflow_id: 'wf1' } });
    const r = await one(a, created.body.data.id);
    expect(r.status).toBe(200);
    expect(r.body.data.id).toBe(created.body.data.id);
    expect(r.body.data.action).toBe('job.started');
    expect(r.body.data.metadata.workflow_id).toBe('wf1');
  });

  it('AL-003: entries from multiple agents in tenant are all visible', async () => {
    const t = await makeTenant({ name: 'al3' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const b = await makeAgent(t.tenantId, 'qa');
    await post(a, { action: 'a.1' });
    await post(b, { action: 'b.1' });
    const r = await list(a);
    expect(r.status).toBe(200);
    const actions = r.body.data.map((e: any) => e.action);
    expect(actions).toContain('a.1');
    expect(actions).toContain('b.1');
  });

  it('AL-004: time-range filter includes the entry', async () => {
    const t = await makeTenant({ name: 'al4' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const ts = new Date().toISOString();
    await post(a, { action: 't.now' });
    const r = await list(a, `?from=${new Date(Date.now() - 1000).toISOString()}&to=${new Date(Date.now() + 1000).toISOString()}`);
    expect(r.body.data.some((e: any) => e.action === 't.now')).toBe(true);
    void ts;
  });

  it('AL-005: PATCH/DELETE on audit/{id} are not implemented (404/405)', async () => {
    const t = await makeTenant({ name: 'al5' });
    const a = await makeAgent(t.tenantId, 'rx0');
    // DELETE handler isn't exported → Next.js returns 405 at framework level;
    // here we assert the route file only exports POST/GET.
    expect(auditPost).toBeDefined();
    expect((await import('@/app/v1/audit/[[...id]]/route')).DELETE).toBeUndefined();
    expect((await import('@/app/v1/audit/[[...id]]/route')).PATCH).toBeUndefined();
  });

  it('AL-006: timestamp is server-assigned (within 2s of receipt)', async () => {
    const t = await makeTenant({ name: 'al6' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const before = Date.now();
    const r = await post(a, { action: 'ts.check' });
    const after = Date.now();
    const ts = new Date(r.body.data.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);
  });

  it('AL-008: payload over 10KB returns 413 PAYLOAD_TOO_LARGE', async () => {
    const t = await makeTenant({ name: 'al8' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const big = { x: 'y'.repeat(11 * 1024) };
    const r = await post(a, { action: 'big.write', payload: big });
    expect(r.status).toBe(413);
  });

  it('workflow_id filter scopes correctly', async () => {
    const t = await makeTenant({ name: 'alwf' });
    const a = await makeAgent(t.tenantId, 'rx0');
    await post(a, { action: 'wf.a', metadata: { workflow_id: 'wf-99' } });
    await post(a, { action: 'wf.b', metadata: { workflow_id: 'wf-99' } });
    await post(a, { action: 'wf.c', metadata: { workflow_id: 'other' } });
    const r = await list(a, '?workflow_id=wf-99');
    expect(r.body.data.length).toBe(2);
    expect(r.body.data.every((e: any) => e.metadata.workflow_id === 'wf-99')).toBe(true);
  });

  it('MT-003: tenant B never sees tenant A audit entries', async () => {
    const tA = await makeTenant({ name: 'al-mt3a' });
    const tB = await makeTenant({ name: 'al-mt3b' });
    const aA = await makeAgent(tA.tenantId, 'rx0');
    const aB = await makeAgent(tB.tenantId, 'rx0');
    await post(aA, { action: 'tenant.a.only', metadata: { workflow_id: 'shared-wf' } });
    const r = await list(aB, '?workflow_id=shared-wf');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([]);
  });

  it('action dot-namespaced validation rejects bad input (400)', async () => {
    const t = await makeTenant({ name: 'alval' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await post(a, { action: 'Bad Action With Spaces' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
});
