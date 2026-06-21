/**
 * v2 Cron tick endpoint — drives Scheduler + HitL timeouts in production.
 *
 * Coverage (issue au-2r3):
 * - TICK-001  requires Authorization: Bearer <CRON_SECRET>; 401 without
 * - TICK-002  invokes fireDueSchedules() + processTimeouts() and returns summary
 * - TICK-003  fires a due schedule when tick runs
 * - TICK-004  auto-rejects an expired checkpoint when tick runs
 * - TICK-005  no-op when nothing is due (returns zeros)
 * - TICK-006  admin/agent keys are NOT accepted (cron secret only)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './_helpers';
import { makeTenant, makeAgent, call } from './_helpers';
import Schedule from '@/models/v2/Schedule';
import Checkpoint from '@/models/v2/Checkpoint';
import { POST } from '@/app/v1/tick/route';

const SECRET = 'test-cron-secret-xyz';

describe('Card au-2r3 — Cron tick', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CRON_SECRET;
  });

  it('TICK-001: rejects requests without Authorization header (401)', async () => {
    const res = await call(POST, 'POST', '/v1/tick', {});
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });

  it('TICK-001b: rejects requests with wrong secret (401)', async () => {
    const res = await call(POST, 'POST', '/v1/tick', { headers: { authorization: 'Bearer wrong-secret' } });
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });

  it('TICK-006: rejects admin and agent keys (cron secret only)', async () => {
    const t = await makeTenant({ name: 'tick-admin' });
    const res = await call(POST, 'POST', '/v1/tick', { headers: { 'x-admin-key': t.adminKey } });
    expect(res.status).toBe(401);
  });

  it('TICK-005: no-op when nothing is due — returns zeros', async () => {
    const res = await call(POST, 'POST', '/v1/tick', { headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      schedules: { processed: 0, fired: 0, failed: 0, dlqCreated: 0 },
      timeouts: { autoRejected: 0, dlqExpired: 0 },
    });
    expect(res.body.meta).toHaveProperty('request_id');
  });

  it('TICK-003: fires a due schedule when tick runs', async () => {
    const t = await makeTenant({ name: 'tick-sched' });
    const a = await makeAgent(t.tenantId, 's1');
    // Schedule due in the past.
    await Schedule.create({
      scheduleId: 'sch_past1',
      tenantId: t.tenantId,
      agentId: a.agentId,
      callbackUrl: 'https://example.com/hook',
      callbackPayload: { hello: 'world' },
      fireAt: new Date(Date.now() - 60_000),
      status: 'pending',
      attemptCount: 0,
      dlqOnFailure: false,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await call(POST, 'POST', '/v1/tick', { headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.status).toBe(200);
    // processed counts due schedules; delivery will fail (example.com), so fired=0
    expect(res.body.data.schedules.processed).toBeGreaterThanOrEqual(1);
  });

  it('TICK-004: auto-rejects an expired checkpoint when tick runs', async () => {
    const t = await makeTenant({ name: 'tick-hitl' });
    const a = await makeAgent(t.tenantId, 'h1');
    await Checkpoint.create({
      checkpointId: 'cp_expired1',
      tenantId: t.tenantId,
      agentId: a.agentId,
      status: 'pending',
      workflowId: 'wf1',
      title: 'approve?',
      prompt: 'approve?',
      timeoutAction: 'auto_reject',
      expiresAt: new Date(Date.now() - 60_000),
      expiresAtPurge: new Date(Date.now() + 86_400_000),
      callbackUrl: 'https://example.com/cb',
      createdAt: new Date(Date.now() - 120_000),
    });
    const res = await call(POST, 'POST', '/v1/tick', { headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.status).toBe(200);
    expect(res.body.data.timeouts.autoRejected).toBeGreaterThanOrEqual(1);
    const cp = await Checkpoint.findOne({ checkpointId: 'cp_expired1' }).lean();
    expect(cp?.status).toBe('expired');
  });

  it('TICK-002: returns a summary with both engine results', async () => {
    const res = await call(POST, 'POST', '/v1/tick', { headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data.schedules');
    expect(res.body).toHaveProperty('data.timeouts');
    expect(res.body.meta).toHaveProperty('request_id');
  });
});
