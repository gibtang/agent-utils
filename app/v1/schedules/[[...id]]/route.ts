/**
 * Scheduler routes (PRD §9). `once` schedules only.
 *   POST   /v1/schedules
 *   GET    /v1/schedules
 *   GET    /v1/schedules/{id}
 *   PATCH  /v1/schedules/{id}
 *   DELETE /v1/schedules/{id}   (cancel)
 */
import { createRoute } from '@/lib/v2/route';
import { agentIdOf } from '@/lib/v2/auth';
import { Errors } from '@/lib/v2/errors';
import { resourceId } from '@/lib/v2/ids';
import Schedule, { ScheduleStatus, type ISchedule } from '@/models/v2/Schedule';
import { reserveCountedQuota, releaseCountedQuota } from '@/lib/v2/quota';
import { validateCallbackUrl } from '@/lib/v2/callbackSecurity';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';

const MIN_FIRE = 60_000;
const MAX_FIRE = 30 * 86400_000;
const RETENTION_DAYS = 30;
const PAYLOAD_MAX = 100 * 1024;
const HTTPS_RE = /^https:\/\//i;

function utf8Bytes(s: string): number {
  return typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : new TextEncoder().encode(s).length;
}

function serialize(s: ISchedule) {
  return {
    id: s.scheduleId,
    agent_id: s.agentId,
    callback_url: s.callbackUrl,
    callback_payload: s.callbackPayload ?? null,
    fire_at: s.fireAt instanceof Date ? s.fireAt.toISOString() : s.fireAt,
    status: s.status,
    attempt_count: s.attemptCount,
    last_attempt_at: s.lastAttemptAt ? (s.lastAttemptAt instanceof Date ? s.lastAttemptAt.toISOString() : s.lastAttemptAt) : null,
    fired_at: s.firedAt ? (s.firedAt instanceof Date ? s.firedAt.toISOString() : s.firedAt) : null,
    dlq_on_failure: s.dlqOnFailure,
    label: s.label ?? null,
    created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

function idFromParams(params: { id?: string[] }): string {
  return Array.isArray(params.id) && params.id.length ? params.id[0] : '';
}

// ── POST ─────────────────────────────────────────────────────────────────────
export const POST = createRoute({ agentKey: true, idempotent: 'POST /v1/schedules' }, async (ctx) => {
  const body = (ctx.body ?? {}) as {
    callback_url?: string;
    callback_payload?: unknown;
    fire_at?: string;
    dlq_on_failure?: boolean;
    label?: string;
  };
  if (!body.callback_url || !HTTPS_RE.test(body.callback_url) || body.callback_url.length > 2048) {
    return Errors.validation('callback_url must be a valid HTTPS URL', { field: 'callback_url' });
  }
  // SSRF-validate the callback URL (PRD §6.2, before storage).
  const urlCheck = await validateCallbackUrl(body.callback_url);
  if (!urlCheck.ok) return urlCheck.error!;

  const fireAtMs = Date.parse(body.fire_at ?? '');
  if (!Number.isFinite(fireAtMs)) {
    return Errors.validation('fire_at must be a valid ISO 8601 timestamp', { field: 'fire_at' });
  }
  const delta = fireAtMs - Date.now();
  if (delta < MIN_FIRE) return Errors.validation('fire_at must be ≥ 60 seconds in the future', { field: 'fire_at' });
  if (delta > MAX_FIRE) return Errors.validation('fire_at must be ≤ 30 days in the future', { field: 'fire_at' });

  if (body.callback_payload !== undefined && body.callback_payload !== null && utf8Bytes(JSON.stringify(body.callback_payload)) > PAYLOAD_MAX) {
    return Errors.payloadTooLarge('callback_payload max 100KB');
  }
  if (body.label && body.label.length > 256) {
    return Errors.validation('label max 256 chars', { field: 'label' });
  }

  // Quota (atomic).
  const q = await reserveCountedQuota(ctx.resolved.tenantId, ctx.resolved.plan, 'activeScheduleCount', 'schedulesActive');
  if (!q.ok) return Errors.quotaExceeded('schedules_active', q.used, q.limit);

  const scheduleId = resourceId('sched_');
  const now = new Date();
  try {
    const sched = await Schedule.create({
      scheduleId,
      tenantId: ctx.resolved.tenantId,
      agentId: agentIdOf(ctx.resolved),
      callbackUrl: body.callback_url,
      callbackPayload: body.callback_payload ?? null,
      fireAt: new Date(fireAtMs),
      status: 'pending',
      dlqOnFailure: body.dlq_on_failure ?? true,
      label: body.label ?? null,
      expiresAt: new Date(now.getTime() + RETENTION_DAYS * 86400_000),
    });
    return { kind: 'created' as const, data: serialize(sched) };
  } catch (e) {
    await releaseScheduleQuota(ctx.resolved.tenantId);
    throw e;
  }
});

// ── GET (list + single) ──────────────────────────────────────────────────────
export const GET = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const tenantId = ctx.resolved.tenantId;
  const agentId = agentIdOf(ctx.resolved);
  const id = idFromParams(ctx.params);

  if (id) {
    const s = await Schedule.findOne({ scheduleId: id }).lean();
    if (!s || s.tenantId !== tenantId) return Errors.notFound('schedule not found');
    if (s.agentId !== agentId) return Errors.forbidden();
    return { kind: 'ok' as const, data: serialize(s) };
  }

  const url = new URL(ctx.req.url);
  const filter: Record<string, unknown> = { tenantId, agentId };
  const status = url.searchParams.get('status') as ScheduleStatus | null;
  if (status) filter.status = status;
  const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (cursor?._id) filter._id = { $lt: new (await import('mongoose')).default.Types.ObjectId(String(cursor._id)) };

  const rows = await Schedule.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = (hasMore ? rows.slice(0, limit) : rows) as ISchedule[];
  const nextCursor = hasMore && slice.length ? encodeCursor({ _id: String(slice[slice.length - 1]._id) }) : undefined;
  return { kind: 'list' as const, data: slice.map(serialize), cursor: nextCursor ?? '', has_more: hasMore };
});

// ── PATCH ────────────────────────────────────────────────────────────────────
export const PATCH = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const id = idFromParams(ctx.params);
  const s = (await Schedule.findOne({ scheduleId: id }).lean()) as ISchedule | null;
  if (!s || s.tenantId !== ctx.resolved.tenantId) return Errors.notFound('schedule not found');
  if (s.agentId !== agentIdOf(ctx.resolved)) return Errors.forbidden();
  if (s.status !== 'pending') return Errors.conflict('Schedule already cancelled', { code: 'SCHEDULE_ALREADY_CANCELLED' });

  const body = (ctx.body ?? {}) as {
    callback_url?: string;
    callback_payload?: unknown;
    fire_at?: string;
    label?: string;
  };
  const set: Record<string, unknown> = {};
  if (body.callback_url !== undefined) {
    if (!HTTPS_RE.test(body.callback_url) || body.callback_url.length > 2048) {
      return Errors.validation('callback_url must be a valid HTTPS URL', { field: 'callback_url' });
    }
    const check = await validateCallbackUrl(body.callback_url);
    if (!check.ok) return check.error!;
    set.callbackUrl = body.callback_url;
  }
  if (body.callback_payload !== undefined) {
    if (body.callback_payload !== null && utf8Bytes(JSON.stringify(body.callback_payload)) > PAYLOAD_MAX) {
      return Errors.payloadTooLarge('callback_payload max 100KB');
    }
    set.callbackPayload = body.callback_payload;
  }
  if (body.fire_at !== undefined) {
    const ms = Date.parse(body.fire_at);
    if (!Number.isFinite(ms)) return Errors.validation('fire_at invalid', { field: 'fire_at' });
    const delta = ms - Date.now();
    if (delta < MIN_FIRE || delta > MAX_FIRE) return Errors.validation('fire_at out of range', { field: 'fire_at' });
    set.fireAt = new Date(ms);
  }
  if (body.label !== undefined) {
    if (body.label && body.label.length > 256) return Errors.validation('label max 256 chars', { field: 'label' });
    set.label = body.label;
  }

  const updated = await Schedule.findOneAndUpdate({ scheduleId: id, status: 'pending' }, { $set: set }, { returnDocument: "after" }).lean();
  if (!updated) return Errors.conflict('Schedule already cancelled');
  return { kind: 'ok' as const, data: serialize(updated) };
});

// ── DELETE (cancel) ──────────────────────────────────────────────────────────
export const DELETE = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const id = idFromParams(ctx.params);
  const s = (await Schedule.findOne({ scheduleId: id }).lean()) as ISchedule | null;
  if (!s || s.tenantId !== ctx.resolved.tenantId) return Errors.notFound('schedule not found');
  if (s.agentId !== agentIdOf(ctx.resolved)) return Errors.forbidden();

  // R-SCH-3: if already fired, return 409.
  if (s.status === 'fired') return Errors.conflict('Schedule already fired');
  if (s.status === 'cancelled') return Errors.conflict('Schedule already cancelled');
  if (s.status === 'failed') return Errors.conflict('Schedule already failed');

  const updated = await Schedule.findOneAndUpdate(
    { scheduleId: id, status: 'pending' },
    { $set: { status: 'cancelled' } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return Errors.conflict('Schedule already cancelled');
  await releaseScheduleQuota(ctx.resolved.tenantId);
  return { kind: 'noContent' as const };
});

function releaseScheduleQuota(tenantId: string) {
  return releaseCountedQuota(tenantId, 'activeScheduleCount');
}
