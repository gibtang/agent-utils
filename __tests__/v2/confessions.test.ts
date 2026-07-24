import { describe, it, expect, vi } from 'vitest';
import { POST as confessionPost, GET as confessionsGet } from '@/app/v1/confessions/route';
import { GET as confessionGet } from '@/app/v1/confessions/[id]/route';
import { POST as respondPost } from '@/app/v1/confessions/[id]/respond/route';
import { GET as reviewGet } from '@/app/v1/confessions/[id]/review/route';
import { processConfessionTimeouts, deliverConfessionCallback } from '@/lib/v2/confessions';
import Confession from '@/models/v2/Confession';
import DlqItem from '@/models/v2/DlqItem';
import { call, agentHeaders, adminHeaders, makeAgent, makeTenant } from './_helpers';

const create = (agent: { agentId: string; apiKey: string }, body: Record<string, unknown> = {}) =>
  call(confessionPost, 'POST', '/v1/confessions', {
    headers: agentHeaders(agent.agentId, agent.apiKey),
    body: { summary: 'Auth refactor is uncertain', concerns: ['Two competing JWT patterns'], confidence: 0.4, ...body },
  });

describe('Confessions', () => {
  it('creates an open confession and validates its input', async () => {
    const tenant = await makeTenant({ name: 'conf-create' });
    const agent = await makeAgent(tenant.tenantId, 'confessor');
    const created = await create(agent, { urgency: 'blocking', blocking: true, timeout_seconds: 3600 });
    expect(created.status).toBe(201);
    expect(created.body.data.id).toMatch(/^conf_/);
    expect(created.body.data.status).toBe('open');

    for (const body of [
      { summary: '', concerns: ['x'], confidence: 0.5 },
      { summary: 'x', concerns: [], confidence: 0.5 },
      { summary: 'x', concerns: ['x'], confidence: 2 },
      { summary: 'x', concerns: ['x'], confidence: 0.5, urgency: 'now' },
      { summary: 'x', concerns: ['x'], confidence: 0.5, callback_url: 'http://example.com' },
    ]) expect((await create(agent, body)).status).toBe(400);
  });

  it('creates only at the collection URL and makes blocking an explicit poll signal', async () => {
    const tenant = await makeTenant({ name: 'conf-path' });
    const agent = await makeAgent(tenant.tenantId, 'path-agent');
    const blocked = await create(agent, { blocking: true });
    expect(blocked.status).toBe(201);
    expect(blocked.body.data).toMatchObject({ blocking: true, poll_after_seconds: 5 });
  });

  it('lists and fetches only the caller tenant records', async () => {
    const aTenant = await makeTenant({ name: 'conf-isolation-a' });
    const bTenant = await makeTenant({ name: 'conf-isolation-b' });
    const a = await makeAgent(aTenant.tenantId, 'agent-a');
    const b = await makeAgent(bTenant.tenantId, 'agent-b');
    const mine = await create(a);
    await create(b);
    const list = await call(confessionsGet, 'GET', '/v1/confessions?status=open&agent_id=agent-a', { headers: agentHeaders(a.agentId, a.apiKey) });
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const foreign = await call(confessionGet, 'GET', `/v1/confessions/${mine.body.data.id}`, { headers: agentHeaders(b.agentId, b.apiKey), params: { id: mine.body.data.id } });
    expect(foreign.status).toBe(404);
  });

  it('requires an approval/admin key, resolves atomically, and rejects repeats', async () => {
    const tenant = await makeTenant({ name: 'conf-respond' });
    const agent = await makeAgent(tenant.tenantId, 'confessor');
    const created = await create(agent);
    const agentAttempt = await call(respondPost, 'POST', `/v1/confessions/${created.body.data.id}/respond`, { body: { guidance: 'Use JWT', action: 'continue' }, headers: agentHeaders(agent.agentId, agent.apiKey), params: { id: created.body.data.id } });
    expect(agentAttempt.status).toBe(403);
    const resolved = await call(respondPost, 'POST', `/v1/confessions/${created.body.data.id}/respond`, { body: { guidance: 'Use JWT', action: 'continue' }, headers: adminHeaders(tenant.adminKey), params: { id: created.body.data.id } });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toMatchObject({ status: 'resolved', action: 'continue', guidance: 'Use JWT' });
    const repeat = await call(respondPost, 'POST', `/v1/confessions/${created.body.data.id}/respond`, { body: { guidance: 'again', action: 'abort' }, headers: adminHeaders(tenant.adminKey), params: { id: created.body.data.id } });
    expect(repeat.status).toBe(409);
  });

  it('processes continue, abort, and DLQ escalation timeouts exactly once', async () => {
    const tenant = await makeTenant({ name: 'conf-timeouts' });
    const agent = await makeAgent(tenant.tenantId, 'timer');
    const expired = new Date(Date.now() - 1000);
    for (const [id, timeoutAction] of [['conf_continue', 'continue'], ['conf_abort', 'abort'], ['conf_dlq', 'escalate_to_dlq']] as const) {
      await Confession.create({ confessionId: id, tenantId: tenant.tenantId, agentId: agent.agentId, summary: id, concerns: ['x'], confidence: 0.5, context: null, urgency: 'low', status: 'open', blocking: false, expiresAt: expired, timeoutAction, expiresAtPurge: new Date(Date.now() + 86400_000) });
    }
    const result = await processConfessionTimeouts({ now: new Date() });
    expect(result).toEqual({ continued: 1, aborted: 1, dlqEscalated: 1 });
    expect((await Confession.findOne({ confessionId: 'conf_continue' }).lean())!.action).toBe('continue');
    expect((await Confession.findOne({ confessionId: 'conf_abort' }).lean())!.action).toBe('abort');
    expect((await Confession.findOne({ confessionId: 'conf_dlq' }).lean())!.status).toBe('expired');
    expect(await DlqItem.exists({ source: 'confession', sourceId: 'conf_dlq' })).toBeTruthy();
    expect(await processConfessionTimeouts({ now: new Date() })).toEqual({ continued: 0, aborted: 0, dlqEscalated: 0 });
  });

  it('rejects scalar JSON response bodies and keeps review data behind reviewer credentials', async () => {
    const tenant = await makeTenant({ name: 'conf-review' });
    const agent = await makeAgent(tenant.tenantId, 'review-agent');
    const created = await create(agent, { context: { secret: 'do not render publicly' } });
    const id = created.body.data.id;
    const scalar = await call(respondPost, 'POST', `/v1/confessions/${id}/respond`, { body: ['not', 'an', 'object'], headers: adminHeaders(tenant.adminKey), params: { id } });
    expect(scalar.status).toBe(400);
    const anonymous = await call(reviewGet, 'GET', `/v1/confessions/${id}/review`, { params: { id } });
    expect(anonymous.status).toBe(403);
    const reviewed = await call(reviewGet, 'GET', `/v1/confessions/${id}/review`, { headers: adminHeaders(tenant.adminKey), params: { id } });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data).toMatchObject({ id, summary: 'Auth refactor is uncertain', context: { secret: 'do not render publicly' } });
  });

  it('delivers signed callbacks after human resolution', async () => {
    const tenant = await makeTenant({ name: 'conf-callback' });
    const agent = await makeAgent(tenant.tenantId, 'callback-agent');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const created = await create(agent, { callback_url: 'https://example.com/confession-hook' });
    const id = created.body.data.id;
    const resolved = await call(respondPost, 'POST', `/v1/confessions/${id}/respond`, { body: { guidance: 'Proceed safely', action: 'continue' }, headers: adminHeaders(tenant.adminKey), params: { id } });
    expect(resolved.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/confession-hook', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-AgentUtils-Event': 'confession.resolved', 'X-AgentUtils-Signature': expect.stringMatching(/^v1=/) }) }));
    fetchMock.mockRestore();
  });

  it('records callback delivery failure without rolling back a resolution', async () => {
    const tenant = await makeTenant({ name: 'conf-callback-failure' });
    const agent = await makeAgent(tenant.tenantId, 'callback-fail-agent');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('hook offline'));
    const created = await create(agent, { callback_url: 'https://example.com/offline-hook' });
    const id = created.body.data.id;
    const resolved = await call(respondPost, 'POST', `/v1/confessions/${id}/respond`, { body: { guidance: 'Proceed', action: 'continue' }, headers: adminHeaders(tenant.adminKey), params: { id } });
    expect(resolved.status).toBe(200);
    expect((await Confession.findOne({ confessionId: id }).lean())!).toMatchObject({ status: 'resolved', callbackAttempts: 1, callbackLastError: expect.stringContaining('hook offline') });
    fetchMock.mockRestore();
  });

  it('recovers a prior DLQ insertion by expiring the confession exactly once', async () => {
    const tenant = await makeTenant({ name: 'conf-dlq-recovery' });
    const agent = await makeAgent(tenant.tenantId, 'recover-agent');
    const now = new Date();
    await Confession.create({ confessionId: 'conf_recover_dlq', tenantId: tenant.tenantId, agentId: agent.agentId, summary: 'recover', concerns: ['x'], confidence: 0.5, context: null, urgency: 'low', status: 'open', blocking: false, expiresAt: new Date(now.getTime() - 1000), timeoutAction: 'escalate_to_dlq', expiresAtPurge: new Date(now.getTime() + 86400_000) });
    await DlqItem.create({ dlqId: 'dlq_recovery', tenantId: tenant.tenantId, agentId: agent.agentId, workflowId: null, operation: 'confession.timeout', source: 'confession', sourceId: 'conf_recover_dlq', payload: {}, errorType: 'TIMEOUT', errorMessage: 'already inserted', errorCode: 'CONFESSION_TIMEOUT', failedAt: now, status: 'failed', attemptCount: 0, maxAttempts: 5, expiresAt: new Date(now.getTime() + 86400_000) });
    expect(await processConfessionTimeouts({ now })).toEqual({ continued: 0, aborted: 0, dlqEscalated: 1 });
    expect(await DlqItem.countDocuments({ source: 'confession', sourceId: 'conf_recover_dlq' })).toBe(1);
    expect((await Confession.findOne({ confessionId: 'conf_recover_dlq' }).lean())!.status).toBe('expired');
  });

  it('enforces the free monthly confession quota atomically', async () => {
    const tenant = await makeTenant({ name: 'conf-quota' });
    const agent = await makeAgent(tenant.tenantId, 'quota-agent');
    const attempts = await Promise.all(Array.from({ length: 11 }, (_, i) => create(agent, { summary: `quota ${i}` })));
    expect(attempts.filter(r => r.status === 201)).toHaveLength(10);
    expect(attempts.filter(r => r.status === 429)).toHaveLength(1);
  });

  it('compensates the quota reservation when persistence fails', async () => {
    const tenant = await makeTenant({ name: 'conf-quota-compensate' });
    const agent = await makeAgent(tenant.tenantId, 'quota-compensate-agent');
    const createSpy = vi.spyOn(Confession, 'create').mockRejectedValueOnce(new Error('database unavailable'));
    expect((await create(agent)).status).toBe(500);
    expect((await (await import('@/models/v2/Tenant')).default.findOne({ tenantId: tenant.tenantId }).lean())!.confessionMonthlyCount).toBe(0);
    createSpy.mockRestore();
  });

  it('bounds concern count and total request bytes before reserving quota', async () => {
    const tenant = await makeTenant({ name: 'conf-input-bounds' });
    const agent = await makeAgent(tenant.tenantId, 'input-bounds-agent');
    expect((await create(agent, { concerns: Array.from({ length: 101 }, () => 'x') })).status).toBe(400);
    expect((await create(agent, { context: { data: 'x'.repeat(51 * 1024) } })).status).toBe(413);
    expect((await (await import('@/models/v2/Tenant')).default.findOne({ tenantId: tenant.tenantId }).lean())!.confessionMonthlyCount).toBe(0);
  });

  it('revalidates stored callback URLs at delivery and does not fetch a rebinding target', async () => {
    const tenant = await makeTenant({ name: 'conf-delivery-revalidation' });
    const agent = await makeAgent(tenant.tenantId, 'delivery-revalidation-agent');
    const confession = await Confession.create({ confessionId: 'conf_revalidate_delivery', tenantId: tenant.tenantId, agentId: agent.agentId, summary: 'revalidate', concerns: ['x'], confidence: 0.5, context: null, urgency: 'low', status: 'resolved', blocking: false, expiresAt: new Date(), timeoutAction: 'continue', callbackUrl: 'https://127.0.0.1/hook', expiresAtPurge: new Date(Date.now() + 86400_000) });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await deliverConfessionCallback(confession, 'confession.resolved');
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await Confession.findOne({ confessionId: confession.confessionId }).lean())!).toMatchObject({ callbackAttempts: 1, callbackLastError: expect.stringContaining('delivery-time validation') });
    fetchMock.mockRestore();
  });

  it('recovers an abandoned timeout claim on a later tick', async () => {
    const tenant = await makeTenant({ name: 'conf-claim-recovery' });
    const agent = await makeAgent(tenant.tenantId, 'claim-recovery-agent');
    const now = new Date();
    await Confession.create({ confessionId: 'conf_stale_claim', tenantId: tenant.tenantId, agentId: agent.agentId, summary: 'stale claim', concerns: ['x'], confidence: 0.5, context: null, urgency: 'low', status: 'timeout_processing', blocking: false, expiresAt: new Date(now.getTime() - 1000), timeoutAction: 'continue', timeoutClaimId: 'tclaim_crashed', timeoutClaimedAt: new Date(now.getTime() - 6 * 60_000), expiresAtPurge: new Date(now.getTime() + 86400_000) });
    expect(await processConfessionTimeouts({ now })).toEqual({ continued: 1, aborted: 0, dlqEscalated: 0 });
    expect((await Confession.findOne({ confessionId: 'conf_stale_claim' }).lean())!).toMatchObject({ status: 'resolved', action: 'continue', timeoutClaimId: null });
  });

  it('claims timeout before DLQ insertion so a concurrent human resolve cannot create a post-resolution DLQ', async () => {
    const tenant = await makeTenant({ name: 'conf-timeout-claim' });
    const agent = await makeAgent(tenant.tenantId, 'claim-agent');
    const now = new Date();
    await Confession.create({ confessionId: 'conf_claim_race', tenantId: tenant.tenantId, agentId: agent.agentId, summary: 'race', concerns: ['x'], confidence: 0.5, context: null, urgency: 'low', status: 'open', blocking: false, expiresAt: new Date(now.getTime() - 1000), timeoutAction: 'escalate_to_dlq', expiresAtPurge: new Date(now.getTime() + 86400_000) });
    const originalUpdate = DlqItem.updateOne.bind(DlqItem);
    const updateSpy = vi.spyOn(DlqItem, 'updateOne').mockImplementationOnce(async (...args: Parameters<typeof DlqItem.updateOne>) => {
      const attemptedResolve = await Confession.findOneAndUpdate({ confessionId: 'conf_claim_race', status: 'open' }, { $set: { status: 'resolved' } });
      expect(attemptedResolve).toBeNull();
      return originalUpdate(...args);
    });
    expect(await processConfessionTimeouts({ now })).toEqual({ continued: 0, aborted: 0, dlqEscalated: 1 });
    expect((await Confession.findOne({ confessionId: 'conf_claim_race' }).lean())!.status).toBe('expired');
    expect(await DlqItem.exists({ source: 'confession', sourceId: 'conf_claim_race' })).toBeTruthy();
    updateSpy.mockRestore();
  });
});
