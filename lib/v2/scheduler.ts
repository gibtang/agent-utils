/**
 * AgentUtils v2 — Scheduler engine (PRD §9.4).
 *
 * fireDueSchedules() is the tick function: finds pending schedules whose fireAt
 * has elapsed, attempts callback delivery with the fixed retry policy
 * (at fireAt, +30s, +90s), and on exhaustion creates a DLQ item when enabled.
 *
 * Designed to be invoked by a cron/worker tick — not in-request. Tests call it
 * directly so we can control time without real waiting.
 */
import Schedule, { ScheduleStatus } from '@/models/v2/Schedule';
import DlqItem from '@/models/v2/DlqItem';
import Tenant from '@/models/v2/Tenant';
import { deliverCallback } from './callbackSecurity';
import { resourceId } from './ids';

const MINUTE = 60_000;
const RETENTION_DAYS = 30;

// Fixed retry intervals after the first attempt (PRD §9.4): +30s, +90s.
const RETRY_DELAYS_MS = [0, 30_000, 90_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length; // 3

/** Determine if a schedule is due for its next attempt right now. */
export function nextAttemptDue(schedule: {
  fireAt: Date;
  status: ScheduleStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
}, now: Date = new Date()): boolean {
  if (schedule.status !== 'pending') return false;
  if (schedule.attemptCount >= MAX_ATTEMPTS) return false;
  const nowMs = now.getTime();
  if (schedule.attemptCount === 0) {
    return new Date(schedule.fireAt).getTime() <= nowMs;
  }
  const base = schedule.lastAttemptAt ? new Date(schedule.lastAttemptAt).getTime() : new Date(schedule.fireAt).getTime();
  const delay = RETRY_DELAYS_MS[schedule.attemptCount] ?? 0;
  return base + delay <= nowMs;
}

export interface FireResult {
  processed: number;
  fired: number;
  failed: number;
  dlqCreated: number;
}

export async function fireDueSchedules(opts: { now?: Date; limit?: number } = {}): Promise<FireResult> {
  const now = (opts.now ?? new Date()).getTime();
  const result: FireResult = { processed: 0, fired: 0, failed: 0, dlqCreated: 0 };

  // Find pending schedules due for an attempt.
  const candidates = await Schedule.find({ status: 'pending', fireAt: { $lte: new Date(now) } })
    .limit(opts.limit ?? 100)
    .lean();

  for (const sched of candidates) {
    const s = sched as {
      scheduleId: string;
      tenantId: string;
      agentId: string;
      callbackUrl: string;
      callbackPayload: unknown;
      attemptCount: number;
      dlqOnFailure: boolean;
      fireAt: Date;
      status: ScheduleStatus;
      lastAttemptAt: Date | null;
    };
    if (!nextAttemptDue(s, new Date(now))) continue;
    result.processed++;
    await attemptSchedule(s, new Date(now));
  }
  return result;
}

async function attemptSchedule(sched: { scheduleId: string; tenantId: string; agentId: string; callbackUrl: string; callbackPayload: unknown; attemptCount: number; dlqOnFailure: boolean }, now: Date) {
  // Fetch tenant for the callback secret.
  const tenant = await Tenant.findOne({ tenantId: sched.tenantId }).lean();
  const secret = (tenant as { callbackSecret?: string } | null)?.callbackSecret ?? '';
  const deliveryId = resourceId('del_');

  const body = {
    event: 'schedule.fired',
    schedule_id: sched.scheduleId,
    agent_id: sched.agentId,
    fired_at: now.toISOString(),
    attempt: sched.attemptCount + 1,
    payload: sched.callbackPayload,
  };

  const res = await deliverCallback(sched.callbackUrl, secret, 'schedule.fired', body, deliveryId, {
    'X-AgentUtils-Schedule-Id': sched.scheduleId,
    'X-AgentUtils-Attempt': String(sched.attemptCount + 1),
  });

  if (res.ok) {
    await Schedule.updateOne(
      { scheduleId: sched.scheduleId, status: 'pending' },
      { $set: { status: 'fired', firedAt: now, lastAttemptAt: now }, $inc: { attemptCount: 1 } },
    );
    // release the active-schedule quota
    await releaseScheduleQuota(sched.tenantId);
    return;
  }

  // Failed attempt — increment, decide next step.
  const newAttempt = sched.attemptCount + 1;
  if (newAttempt < MAX_ATTEMPTS) {
    await Schedule.updateOne(
      { scheduleId: sched.scheduleId },
      { $set: { lastAttemptAt: now }, $inc: { attemptCount: 1 } },
    );
    return;
  }

  // Exhausted.
  await Schedule.updateOne(
    { scheduleId: sched.scheduleId, status: 'pending' },
    { $set: { status: 'failed', lastAttemptAt: now }, $inc: { attemptCount: 1 } },
  );
  await releaseScheduleQuota(sched.tenantId);

  if (sched.dlqOnFailure) {
    await DlqItem.create({
      dlqId: resourceId('dlq_'),
      tenantId: sched.tenantId,
      agentId: sched.agentId,
      workflowId: null,
      operation: 'scheduler.callback',
      source: 'scheduler',
      sourceId: sched.scheduleId,
      payload: { callback_payload: sched.callbackPayload, callback_url: sched.callbackUrl, attempts: newAttempt },
      errorType: `HTTP_${res.status || 0}`,
      errorMessage: `Schedule callback delivery failed: ${res.statusText}`,
      errorCode: 'CALLBACK_DELIVERY_FAILED',
      failedAt: now,
      status: 'failed',
      attemptCount: 0,
      maxAttempts: 5,
      expiresAt: new Date(now.getTime() + RETENTION_DAYS * MINUTE * 24),
    });
    // bump dlq quota counter
    await Tenant.updateOne({ tenantId: sched.tenantId }, { $inc: { dlqItemCount: 1 } });
  }
}

import { releaseCountedQuota } from './quota';
function releaseScheduleQuota(tenantId: string) {
  return releaseCountedQuota(tenantId, 'activeScheduleCount');
}
