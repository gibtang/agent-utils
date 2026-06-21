/**
 * Card 8 (833f): HitL Checkpoint with approval-proxy permissions.
 * Covers HITL-001..HITL-014, CROSS-002 (HitL→DLQ), R-HITL-1..8.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as cpPost, GET as cpGet, DELETE as cpDelete } from '@/app/v1/checkpoints/[[...id]]/route';
import { POST as approvePost } from '@/app/v1/checkpoints/[id]/approve/route';
import { POST as rejectPost } from '@/app/v1/checkpoints/[id]/reject/route';
import { POST as approvalKeyPost } from '@/app/v1/approval-keys/route';
import { applyResolution, processTimeouts } from '@/lib/v2/hitl';
import Checkpoint from '@/models/v2/Checkpoint';
import DlqItem from '@/models/v2/DlqItem';
import { GET as dlqGet } from '@/app/v1/dlq/[[...id]]/route';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { call, agentHeaders, adminHeaders, makeAgent, makeTenant } from './_helpers';

let server: Server;
let callbackBase: string;
let received: any[] = [];
let respondStatus = 200;

beforeEach(async () => {
  received = [];
  respondStatus = 200;
  server = createServer((req, res) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => {
      received.push({ url: req.url, headers: req.headers, body: buf });
      res.writeHead(respondStatus, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address() as AddressInfo;
  callbackBase = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

const mkCp = async (agent: { agentId: string; apiKey: string }, overrides: Record<string, unknown> = {}, directUrl?: string) => {
  const body = { title: 'Approve deploy', callback_url: directUrl ?? 'https://example.com/hook', ...overrides };
  return call(cpPost, 'POST', '/v1/checkpoints', { body, headers: agentHeaders(agent.agentId, agent.apiKey) });
};

describe('Card 8 — HitL Checkpoint', () => {
  it('HITL-001: agent POST creates a pending checkpoint', async () => {
    const t = await makeTenant({ name: 'h1' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await mkCp(a);
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('pending');
    expect(r.body.data.id).toMatch(/^hitl_/);
  });

  it('HITL-002: GET /checkpoints/{id} returns pending status', async () => {
    const t = await makeTenant({ name: 'h2' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await mkCp(a);
    const r = await call(cpGet, 'GET', `/v1/checkpoints/${created.body.data.id}`, { headers: agentHeaders(a.agentId, a.apiKey), params: { id: [created.body.data.id] } });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('pending');
  });

  it('HITL-014: timeout_action=auto_approve rejected with 400', async () => {
    const t = await makeTenant({ name: 'h14' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const r = await mkCp(a, { timeout_action: 'auto_approve' });
    expect(r.status).toBe(400);
  });

  it('HITL-012: context over 50KB → 413', async () => {
    const t = await makeTenant({ name: 'h12' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const big = { x: 'y'.repeat(51 * 1024) };
    const r = await mkCp(a, { context: big });
    expect(r.status).toBe(413);
  });

  it('HITL-009: over checkpoint quota → 429 QUOTA_EXCEEDED', async () => {
    const t = await makeTenant({ name: 'h9' });
    const a = await makeAgent(t.tenantId, 'rx0');
    for (let i = 0; i < 5; i++) await mkCp(a, { title: `cp-${i}` });
    const over = await mkCp(a, { title: 'cp-over' });
    expect(over.status).toBe(429);
    expect(over.body.error.details.quota).toBe('checkpoints_pending');
  });

  it('HITL-006: approving an already-approved checkpoint → 409', async () => {
    const t = await makeTenant({ name: 'h6' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await mkCp(a);
    await Checkpoint.updateOne({ checkpointId: created.body.data.id }, { $set: { status: 'approved' } });
    const r = await call(approvePost, 'POST', `/v1/checkpoints/${created.body.data.id}/approve`, { body: { by: 'g' }, headers: adminHeaders(t.adminKey), params: { id: created.body.data.id } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CHECKPOINT_ALREADY_RESOLVED');
  });

  it('HITL-013: agent B cannot cancel agent A checkpoint (403)', async () => {
    const t = await makeTenant({ name: 'h13' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const b = await makeAgent(t.tenantId, 'qa');
    const created = await mkCp(a);
    const r = await call(cpDelete, 'DELETE', `/v1/checkpoints/${created.body.data.id}`, { headers: agentHeaders(b.agentId, b.apiKey), params: { id: [created.body.data.id] } });
    expect(r.status).toBe(403);
  });

  it('HITL-011: agent cancels own pending checkpoint (204, no callback)', async () => {
    const t = await makeTenant({ name: 'h11' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await mkCp(a);
    const d = await call(cpDelete, 'DELETE', `/v1/checkpoints/${created.body.data.id}`, { headers: agentHeaders(a.agentId, a.apiKey), params: { id: [created.body.data.id] } });
    expect(d.status).toBe(204);
    expect(received.length).toBe(0);
    const g = await call(cpGet, 'GET', `/v1/checkpoints/${created.body.data.id}`, { headers: agentHeaders(a.agentId, a.apiKey), params: { id: [created.body.data.id] } });
    expect(g.body.data.status).toBe('cancelled');
  });

  it('R-HITL-7: agent key cannot approve (403); admin can', async () => {
    const t = await makeTenant({ name: 'h-r7' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await mkCp(a);
    const agentAttempt = await call(approvePost, 'POST', `/v1/checkpoints/${created.body.data.id}/approve`, {
      body: { by: 'rx0' }, headers: agentHeaders(a.agentId, a.apiKey), params: { id: created.body.data.id },
    });
    // agent key on approve endpoint: no admin/approval header → forbidden
    expect(agentAttempt.status).toBe(403);
    const adminAttempt = await call(approvePost, 'POST', `/v1/checkpoints/${created.body.data.id}/approve`, {
      body: { by: 'gibson' }, headers: adminHeaders(t.adminKey), params: { id: created.body.data.id },
    });
    expect(adminAttempt.status).toBe(200);
    expect(adminAttempt.body.data.status).toBe('approved');
  });

  it('approval-proxy key can approve within tenant', async () => {
    const t = await makeTenant({ name: 'h-proxy' });
    const a = await makeAgent(t.tenantId, 'rx0');
    // admin creates approval-proxy key
    const apr = await call(approvalKeyPost, 'POST', '/v1/approval-keys', { body: { name: 'tg-bot' }, headers: adminHeaders(t.adminKey) });
    expect(apr.status).toBe(201);
    const approvalKey = apr.body.data.approval_key;
    // insert checkpoint directly to bypass SSRF (loopback callback target)
    const cp = await Checkpoint.create({
      checkpointId: 'hitl_proxy_1', tenantId: t.tenantId, agentId: a.agentId,
      title: 'cp', status: 'pending', timeoutAction: 'auto_reject',
      callbackUrl: `${callbackBase}/hook`, callbackPayload: {},
      expiresAt: new Date(Date.now() + 86400_000), expiresAtPurge: new Date(Date.now() + 30 * 86400_000),
    });
    const r = await call(approvePost, 'POST', `/v1/checkpoints/${cp.checkpointId}/approve`, {
      body: { by: 'tg-user' }, headers: { 'x-approval-key': approvalKey }, params: { id: cp.checkpointId },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('approved');
  });

  it('MT-004: cross-tenant approve → 404 (no existence leak)', async () => {
    const tA = await makeTenant({ name: 'h-mt4a' });
    const tB = await makeTenant({ name: 'h-mt4b' });
    const aA = await makeAgent(tA.tenantId, 'rx0');
    const created = await mkCp(aA);
    const r = await call(approvePost, 'POST', `/v1/checkpoints/${created.body.data.id}/approve`, {
      body: { by: 'x' }, headers: adminHeaders(tB.adminKey), params: { id: created.body.data.id },
    });
    expect(r.status).toBe(404);
  });

  it('HITL-003/005: approve/reject fire signed callback', async () => {
    const t = await makeTenant({ name: 'h35' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const cp = await Checkpoint.create({
      checkpointId: 'hitl_cb_1', tenantId: t.tenantId, agentId: a.agentId,
      title: 'cp', status: 'pending', timeoutAction: 'auto_reject',
      callbackUrl: `${callbackBase}/hook`, callbackPayload: { wf: 'x' },
      expiresAt: new Date(Date.now() + 86400_000), expiresAtPurge: new Date(Date.now() + 30 * 86400_000),
    });
    await call(approvePost, 'POST', `/v1/checkpoints/${cp.checkpointId}/approve`, { body: { by: 'g' }, headers: adminHeaders(t.adminKey), params: { id: cp.checkpointId } });
    expect(received.length).toBe(1);
    const body = JSON.parse(received[0].body);
    expect(body.event).toBe('checkpoint.resolved');
    expect(body.decision).toBe('approved');
    expect(body.original_payload.wf).toBe('x');
    expect(received[0].headers['x-agentutils-signature']).toMatch(/^v1=[0-9a-f]+$/);
  });

  it('HITL-010: callback delivery failure creates DLQ (source=checkpoint); status stays approved', async () => {
    const t = await makeTenant({ name: 'h10' });
    const a = await makeAgent(t.tenantId, 'rx0');
    respondStatus = 500;
    // Bypass SSRF validation by inserting directly.
    const cp = await Checkpoint.create({
      checkpointId: 'hitl_dlq_1', tenantId: t.tenantId, agentId: a.agentId,
      title: 'cp', status: 'pending', timeoutAction: 'auto_reject',
      callbackUrl: `${callbackBase}/hook`, callbackPayload: { wf: 'h10' },
      expiresAt: new Date(Date.now() + 86400_000), expiresAtPurge: new Date(Date.now() + 30 * 86400_000),
    });
    await applyResolution(cp.checkpointId, t.tenantId, { decision: 'approved', by: 'g' });
    const fresh = await Checkpoint.findOne({ checkpointId: 'hitl_dlq_1' }).lean();
    expect(fresh!.status).toBe('approved'); // unchanged
    const dlq = await DlqItem.findOne({ tenantId: t.tenantId, source: 'checkpoint' }).lean();
    expect(dlq).toBeTruthy();
    expect(dlq!.sourceId).toBe('hitl_dlq_1');
  });

  it('CROSS-002: HitL→DLQ listable via GET /v1/dlq', async () => {
    const t = await makeTenant({ name: 'h-x2' });
    const a = await makeAgent(t.tenantId, 'rx0');
    respondStatus = 500;
    const cp = await Checkpoint.create({
      checkpointId: 'hitl_x2', tenantId: t.tenantId, agentId: a.agentId,
      title: 'cp', status: 'pending', timeoutAction: 'auto_reject',
      callbackUrl: `${callbackBase}/hook`, callbackPayload: { wf: 'x2' },
      expiresAt: new Date(Date.now() + 86400_000), expiresAtPurge: new Date(Date.now() + 30 * 86400_000),
    });
    await applyResolution(cp.checkpointId, t.tenantId, { decision: 'rejected', by: 'g', note: 'no' });
    const r = await call(dlqGet, 'GET', '/v1/dlq?source=checkpoint', { headers: agentHeaders(a.agentId, a.apiKey) });
    expect(r.body.data.some((d: any) => d.source === 'checkpoint' && d.source_id === 'hitl_x2')).toBe(true);
  });

  it('HITL-007/008: timeouts auto-reject or DLQ via processTimeouts', async () => {
    const t = await makeTenant({ name: 'h78' });
    const a = await makeAgent(t.tenantId, 'rx0');
    // auto_reject timeout
    const cp1 = await Checkpoint.create({
      checkpointId: 'hitl_to1', tenantId: t.tenantId, agentId: a.agentId,
      title: 'ar', status: 'pending', timeoutAction: 'auto_reject',
      callbackUrl: `${callbackBase}/hook`, callbackPayload: {},
      expiresAt: new Date(Date.now() - 1000), expiresAtPurge: new Date(Date.now() + 30 * 86400_000),
    });
    // dlq timeout (SSRF-unsafe URL set directly to loopback)
    const cp2 = await Checkpoint.create({
      checkpointId: 'hitl_to2', tenantId: t.tenantId, agentId: a.agentId,
      title: 'dlq', status: 'pending', timeoutAction: 'dlq',
      callbackUrl: `${callbackBase}/hook`, callbackPayload: {},
      expiresAt: new Date(Date.now() - 1000), expiresAtPurge: new Date(Date.now() + 30 * 86400_000),
    });
    const r = await processTimeouts({ now: new Date() });
    expect(r.autoRejected).toBeGreaterThanOrEqual(1);
    expect(r.dlqExpired).toBeGreaterThanOrEqual(1);
    void cp1; void cp2;
    const dlq = await DlqItem.findOne({ tenantId: t.tenantId, sourceId: 'hitl_to2' }).lean();
    expect(dlq).toBeTruthy();
  });
});
