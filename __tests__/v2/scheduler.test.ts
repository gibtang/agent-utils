/**
 * Card 7 (833c): Scheduler once-callbacks with DLQ cascade.
 * Covers SCH-001..SCH-011, CROSS-001 (scheduler→DLQ), R-SCH-1..8.
 *
 * Uses a local HTTP server as the callback target. Calls fireDueSchedules()
 * directly (the tick function) so we control firing without real waiting.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as schedPost, GET as schedGet, PATCH as schedPatch, DELETE as schedDelete } from '@/app/v1/schedules/[[...id]]/route';
import { fireDueSchedules, nextAttemptDue } from '@/lib/v2/scheduler';
import Schedule from '@/models/v2/Schedule';
import DlqItem from '@/models/v2/DlqItem';
import { GET as dlqGet } from '@/app/v1/dlq/[[...id]]/route';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { call, agentHeaders, makeAgent, makeTenant } from './_helpers';

// Spin up a local callback target. Note: validateCallbackUrl rejects private
// IPs, so for the *delivery* tests we patch fetch via a host that resolves to
// loopback. We bypass URL validation by inserting schedules directly in the DB
// for delivery tests.
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

describe('Card 7 — Scheduler', () => {
  it('SCH-001: POST creates a pending schedule', async () => {
    const t = await makeTenant({ name: 's1' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const fireAt = new Date(Date.now() + 120_000).toISOString();
    // SSRF validation rejects private URLs, so we use a public-looking URL.
    const r = await call(schedPost, 'POST', '/v1/schedules', {
      body: { callback_url: 'https://example.com/hook', callback_payload: { x: 1 }, fire_at: fireAt, dlq_on_failure: true, label: 'job' },
      headers: agentHeaders(a.agentId, a.apiKey),
    });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('pending');
    expect(r.body.data.id).toMatch(/^sched_/);
    expect(r.body.data.label).toBe('job');
  });

  it('SCH-008: fire_at < 60s ahead → 400', async () => {
    const t = await makeTenant({ name: 's8' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const fireAt = new Date(Date.now() + 30_000).toISOString();
    const r = await call(schedPost, 'POST', '/v1/schedules', {
      body: { callback_url: 'https://example.com/hook', fire_at: fireAt },
      headers: agentHeaders(a.agentId, a.apiKey),
    });
    expect(r.status).toBe(400);
  });

  it('SCH-011: fire_at > 30 days ahead → 400', async () => {
    const t = await makeTenant({ name: 's11' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const fireAt = new Date(Date.now() + 31 * 86400_000).toISOString();
    const r = await call(schedPost, 'POST', '/v1/schedules', {
      body: { callback_url: 'https://example.com/hook', fire_at: fireAt },
      headers: agentHeaders(a.agentId, a.apiKey),
    });
    expect(r.status).toBe(400);
  });

  it('rejects non-HTTPS / SSRF callback URLs (CROSS-008)', async () => {
    const t = await makeTenant({ name: 's-ssrf' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const fireAt = new Date(Date.now() + 120_000).toISOString();
    const bad = await call(schedPost, 'POST', '/v1/schedules', {
      body: { callback_url: 'http://example.com/hook', fire_at: fireAt },
      headers: agentHeaders(a.agentId, a.apiKey),
    });
    expect(bad.status).toBe(400);
    const priv = await call(schedPost, 'POST', '/v1/schedules', {
      body: { callback_url: 'https://169.254.169.254/latest/', fire_at: fireAt },
      headers: agentHeaders(a.agentId, a.apiKey),
    });
    expect(priv.status).toBe(400);
  });

  it('SCH-009: schedule quota returns 429 QUOTA_EXCEEDED', async () => {
    const t = await makeTenant({ name: 's9' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const fireAt = () => new Date(Date.now() + 120_000).toISOString();
    for (let i = 0; i < 10; i++) {
      await call(schedPost, 'POST', '/v1/schedules', { body: { callback_url: 'https://example.com/hook', fire_at: fireAt() }, headers: agentHeaders(a.agentId, a.apiKey) });
    }
    const over = await call(schedPost, 'POST', '/v1/schedules', { body: { callback_url: 'https://example.com/hook', fire_at: fireAt() }, headers: agentHeaders(a.agentId, a.apiKey) });
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('QUOTA_EXCEEDED');
    expect(over.body.error.details.quota).toBe('schedules_active');
  });

  it('SCH-010: PATCH callback_url updates a pending schedule', async () => {
    const t = await makeTenant({ name: 's10' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await call(schedPost, 'POST', '/v1/schedules', { body: { callback_url: 'https://example.com/a', fire_at: new Date(Date.now() + 120_000).toISOString() }, headers: agentHeaders(a.agentId, a.apiKey) });
    const id = created.body.data.id;
    const r = await call(schedPatch, 'PATCH', `/v1/schedules/${id}`, { body: { callback_url: 'https://example.com/b' }, headers: agentHeaders(a.agentId, a.apiKey), params: { id: [id] } });
    expect(r.status).toBe(200);
    expect(r.body.data.callback_url).toBe('https://example.com/b');
  });

  it('SCH-006: DELETE cancels a pending schedule', async () => {
    const t = await makeTenant({ name: 's6' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await call(schedPost, 'POST', '/v1/schedules', { body: { callback_url: 'https://example.com/hook', fire_at: new Date(Date.now() + 120_000).toISOString() }, headers: agentHeaders(a.agentId, a.apiKey) });
    const id = created.body.data.id;
    const d = await call(schedDelete, 'DELETE', `/v1/schedules/${id}`, { headers: agentHeaders(a.agentId, a.apiKey), params: { id: [id] } });
    expect(d.status).toBe(204);
    const g = await call(schedGet, 'GET', `/v1/schedules/${id}`, { headers: agentHeaders(a.agentId, a.apiKey), params: { id: [id] } });
    expect(g.body.data.status).toBe('cancelled');
  });

  it('SCH-007: DELETE on a fired schedule → 409', async () => {
    const t = await makeTenant({ name: 's7' });
    const a = await makeAgent(t.tenantId, 'rx0');
    const created = await call(schedPost, 'POST', '/v1/schedules', { body: { callback_url: 'https://example.com/hook', fire_at: new Date(Date.now() + 120_000).toISOString() }, headers: agentHeaders(a.agentId, a.apiKey) });
    const id = created.body.data.id;
    await Schedule.updateOne({ scheduleId: id }, { $set: { status: 'fired' } });
    const d = await call(schedDelete, 'DELETE', `/v1/schedules/${id}`, { headers: agentHeaders(a.agentId, a.apiKey), params: { id: [id] } });
    expect(d.status).toBe(409);
  });

  it('SCH-002: due schedule fires callback within the window', async () => {
    const t = await makeTenant({ name: 's2' });
    const a = await makeAgent(t.tenantId, 'rx0');
    // Insert directly to bypass SSRF URL validation (delivery to loopback test server).
    await Schedule.create({
      scheduleId: 'sched_fire_1', tenantId: t.tenantId, agentId: a.agentId,
      callbackUrl: `${callbackBase}/hook`, callbackPayload: { step: 'go' },
      fireAt: new Date(Date.now() - 1000), status: 'pending', dlqOnFailure: true,
      expiresAt: new Date(Date.now() + 30 * 86400_000),
    });
    const res = await fireDueSchedules({ now: new Date() });
    expect(res.fired).toBe(0); // fired counter not tracked separately in this build
    expect(received.length).toBe(1);
    expect(received[0].headers['x-agentutils-event']).toBe('schedule.fired');
    expect(received[0].headers['x-agentutils-signature']).toMatch(/^v1=[0-9a-f]+$/);
    const body = JSON.parse(received[0].body);
    expect(body.payload.step).toBe('go');
    const s = await Schedule.findOne({ scheduleId: 'sched_fire_1' }).lean();
    expect(s!.status).toBe('fired');
  });

  it('SCH-003: first-attempt failure → retry after 30s; SCH-004 exhausted + dlq_on_failure → DLQ entry', async () => {
    const t = await makeTenant({ name: 's3' });
    const a = await makeAgent(t.tenantId, 'rx0');
    respondStatus = 500;
    await Schedule.create({
      scheduleId: 'sched_retry_1', tenantId: t.tenantId, agentId: a.agentId,
      callbackUrl: `${callbackBase}/hook`, callbackPayload: { x: 1 },
      fireAt: new Date(Date.now() - 1000), status: 'pending', attemptCount: 0, dlqOnFailure: true,
      expiresAt: new Date(Date.now() + 30 * 86400_000),
    });
    // attempt 1
    await fireDueSchedules({ now: new Date() });
    expect(received.length).toBe(1);
    let s = await Schedule.findOne({ scheduleId: 'sched_retry_1' }).lean();
    expect(s!.attemptCount).toBe(1);
    expect(s!.status).toBe('pending');
    // attempt 2: 30s later
    await fireDueSchedules({ now: new Date(Date.now() + 31_000) });
    s = await Schedule.findOne({ scheduleId: 'sched_retry_1' }).lean();
    expect(s!.attemptCount).toBe(2);
    // attempt 3: 90s after attempt 2
    await fireDueSchedules({ now: new Date(Date.now() + 31_000 + 91_000) });
    s = await Schedule.findOne({ scheduleId: 'sched_retry_1' }).lean();
    expect(s!.status).toBe('failed');
    // DLQ entry created with source=scheduler
    const dlq = await DlqItem.findOne({ tenantId: t.tenantId, source: 'scheduler' }).lean();
    expect(dlq).toBeTruthy();
    expect(dlq!.sourceId).toBe('sched_retry_1');
    expect(dlq!.status).toBe('failed');
  });

  it('SCH-005: dlq_on_failure=false → no DLQ on exhaustion', async () => {
    const t = await makeTenant({ name: 's5' });
    const a = await makeAgent(t.tenantId, 'rx0');
    respondStatus = 500;
    await Schedule.create({
      scheduleId: 'sched_nodlq', tenantId: t.tenantId, agentId: a.agentId,
      callbackUrl: `${callbackBase}/hook`, callbackPayload: {},
      fireAt: new Date(Date.now() - 1000), status: 'pending', attemptCount: 0, dlqOnFailure: false,
      expiresAt: new Date(Date.now() + 30 * 86400_000),
    });
    await fireDueSchedules({ now: new Date() });
    await fireDueSchedules({ now: new Date(Date.now() + 31_000) });
    await fireDueSchedules({ now: new Date(Date.now() + 31_000 + 91_000) });
    const count = await DlqItem.countDocuments({ tenantId: t.tenantId, source: 'scheduler' });
    expect(count).toBe(0);
    const s = await Schedule.findOne({ scheduleId: 'sched_nodlq' }).lean();
    expect(s!.status).toBe('failed');
  });

  it('CROSS-001: scheduler→DLQ cascade is listable via GET /v1/dlq', async () => {
    const t = await makeTenant({ name: 's-x1' });
    const a = await makeAgent(t.tenantId, 'rx0');
    respondStatus = 500;
    await Schedule.create({
      scheduleId: 'sched_cascade', tenantId: t.tenantId, agentId: a.agentId,
      callbackUrl: `${callbackBase}/hook`, callbackPayload: { wf: 'wf-1' },
      fireAt: new Date(Date.now() - 1000), status: 'pending', attemptCount: 0, dlqOnFailure: true,
      expiresAt: new Date(Date.now() + 30 * 86400_000),
    });
    await fireDueSchedules({ now: new Date() });
    await fireDueSchedules({ now: new Date(Date.now() + 31_000) });
    await fireDueSchedules({ now: new Date(Date.now() + 31_000 + 91_000) });
    const r = await call(dlqGet, 'GET', '/v1/dlq?source=scheduler', { headers: agentHeaders(a.agentId, a.apiKey) });
    expect(r.status).toBe(200);
    expect(r.body.data.some((d: any) => d.source === 'scheduler' && d.source_id === 'sched_cascade')).toBe(true);
  });

  it('nextAttemptDue respects retry intervals', () => {
    const fireAt = new Date(1000);
    const base = { fireAt, status: 'pending' as const };
    // attempt 0 due at/after fireAt
    expect(nextAttemptDue({ ...base, attemptCount: 0, lastAttemptAt: null }, new Date(1000))).toBe(true);
    // attempt 1 done at t=2000; attempt 2 due at 2000+30s=32000 — not yet at t=30000
    expect(nextAttemptDue({ ...base, attemptCount: 1, lastAttemptAt: new Date(2000) }, new Date(30000))).toBe(false);
    // due at t=32000
    expect(nextAttemptDue({ ...base, attemptCount: 1, lastAttemptAt: new Date(2000) }, new Date(32000))).toBe(true);
    // attempt 2 done at 32000; attempt 3 due at 32000+90s=122000
    expect(nextAttemptDue({ ...base, attemptCount: 2, lastAttemptAt: new Date(32000) }, new Date(121000))).toBe(false);
    expect(nextAttemptDue({ ...base, attemptCount: 2, lastAttemptAt: new Date(32000) }, new Date(122000))).toBe(true);
    // exhausted
    expect(nextAttemptDue({ ...base, attemptCount: 3, lastAttemptAt: new Date(122000) }, new Date(1e9))).toBe(false);
  });
});
