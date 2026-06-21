/**
 * DLQ routes (PRD §10). Independent of Scheduler.
 *
 *   POST   /v1/dlq                  — create failed item
 *   GET    /v1/dlq                  — list (filtered by agent)
 *   GET    /v1/dlq/{id}             — single item
 *   POST   /v1/dlq/{id}/claim       — atomic claim with lock
 *   POST   /v1/dlq/{id}/release     — release claim (back to failed)
 *   POST   /v1/dlq/{id}/fail        — record retry failure (no schedule)
 *   POST   /v1/dlq/{id}/resolve     — mark resolved
 *   DELETE /v1/dlq/{id}             — archive (soft delete, retained)
 *
 * Per-agent scoping: same-tenant other-agent → 403; cross-tenant → 404 (R-DLQ-4).
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { resourceId } from '@/lib/v2/ids';
import DlqItem, { IDlqItem } from '@/models/v2/DlqItem';
import { reserveCountedQuota } from '@/lib/v2/quota';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';

const RETENTION_DAYS = 30;
const PAYLOAD_MAX = 1 * 1024 * 1024;
const ERROR_MSG_MAX = 1024;

function utf8Bytes(s: string): number {
  return typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : new TextEncoder().encode(s).length;
}

function isOwner(item: IDlqItem | null, tenantId: string, agentId: string): 'ok' | 'forbidden' | 'notfound' {
  if (!item) return 'notfound';
  if (item.tenantId !== tenantId) return 'notfound';       // cross-tenant → 404
  if (item.agentId !== agentId) return 'forbidden';         // same tenant other agent → 403
  return 'ok';
}

function serialize(e: IDlqItem, full = true) {
  const exhausted = e.status !== 'resolved' && e.status !== 'archived' && e.attemptCount >= e.maxAttempts;
  return {
    id: e.dlqId,
    agent_id: e.agentId,
    workflow_id: e.workflowId,
    operation: e.operation,
    source: e.source,
    source_id: e.sourceId,
    status: e.status,
    attempt_count: e.attemptCount,
    max_attempts: e.maxAttempts,
    exhausted,
    failed_at: e.failedAt.toISOString(),
    last_attempted_at: e.lastAttemptedAt ? e.lastAttemptedAt.toISOString() : null,
    next_retry_after: e.nextRetryAfter ? e.nextRetryAfter.toISOString() : null,
    locked_by: e.lockedBy,
    locked_until: e.lockedUntil ? e.lockedUntil.toISOString() : null,
    label: e.label,
    resolved_at: e.resolvedAt ? e.resolvedAt.toISOString() : null,
    resolved_by: e.resolvedBy,
    archived_at: e.archivedAt ? e.archivedAt.toISOString() : null,
    created_at: e.createdAt.toISOString(),
    ...(full
      ? {
          payload: e.payload ?? null,
          error: e.errorType ? { type: e.errorType, message: e.errorMessage, code: e.errorCode } : { message: e.errorMessage },
          last_error: e.lastError ?? null,
          result: e.result ?? null,
        }
      : {}),
  };
}

// ── POST /v1/dlq ─────────────────────────────────────────────────────────────
export const POST = createRoute({ agentKey: true, idempotent: 'POST /v1/dlq' }, async (ctx) => {
  const body = (ctx.body ?? {}) as {
    workflow_id?: string;
    operation?: string;
    source?: string;
    source_id?: string;
    payload?: unknown;
    error?: { type?: string; message?: string; code?: string };
    max_attempts?: number;
    label?: string;
  };
  if (!body.operation || body.operation.length > 128) {
    return Errors.validation('operation required, max 128 chars', { field: 'operation' });
  }
  if (!body.source || body.source.length > 128) {
    return Errors.validation('source required, max 128 chars', { field: 'source' });
  }
  if (body.workflow_id && body.workflow_id.length > 256) {
    return Errors.validation('workflow_id max 256 chars', { field: 'workflow_id' });
  }
  if (body.source_id && body.source_id.length > 256) {
    return Errors.validation('source_id max 256 chars', { field: 'source_id' });
  }
  if (body.label && body.label.length > 256) {
    return Errors.validation('label max 256 chars', { field: 'label' });
  }
  const errorMsg = body.error?.message;
  if (!errorMsg || errorMsg.length > ERROR_MSG_MAX) {
    return Errors.validation('error.message required, max 1024 chars', { field: 'error.message' });
  }
  if (body.payload !== undefined && body.payload !== null && utf8Bytes(JSON.stringify(body.payload)) > PAYLOAD_MAX) {
    return Errors.payloadTooLarge('payload max 1MB');
  }
  let maxAttempts = body.max_attempts ?? 5;
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) maxAttempts = 5;

  const q = await reserveCountedQuota(ctx.resolved.tenantId, ctx.resolved.plan, 'dlqItemCount', 'dlqItems');
  if (!q.ok) return Errors.quotaExceeded('dlq_items', q.used, q.limit);

  const now = new Date();
  const dlqId = resourceId('dlq_');
  try {
    const item = await DlqItem.create({
      dlqId,
      tenantId: ctx.resolved.tenantId,
      agentId: ctx.resolved.agentId,
      workflowId: body.workflow_id ?? null,
      operation: body.operation,
      source: body.source,
      sourceId: body.source_id ?? null,
      payload: body.payload ?? null,
      errorType: body.error?.type ?? null,
      errorMessage: errorMsg,
      errorCode: body.error?.code ?? null,
      lastError: null,
      failedAt: now,
      status: 'failed',
      attemptCount: 0,
      maxAttempts,
      lockedBy: null,
      lockedUntil: null,
      label: body.label ?? null,
      expiresAt: new Date(now.getTime() + RETENTION_DAYS * 86400_000),
    });
    return { kind: 'created' as const, data: serialize(item) };
  } catch (e) {
    // release quota on failure
    const { releaseCountedQuota } = await import('@/lib/v2/quota');
    await releaseCountedQuota(ctx.resolved.tenantId, 'dlqItemCount');
    throw e;
  }
});

// ── GET /v1/dlq and /v1/dlq/{id} ─────────────────────────────────────────────
export const GET = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const idSeg = ctx.params.id;
  const id = Array.isArray(idSeg) && idSeg.length ? idSeg[0] : undefined;
  const tenantId = ctx.resolved.tenantId;
  const agentId = ctx.resolved.agentId;

  if (id) {
    const item = await DlqItem.findOne({ dlqId: id }).lean();
    const owner = isOwner(item as IDlqItem | null, tenantId, agentId);
    if (owner === 'notfound') return Errors.dlqNotFound();
    if (owner === 'forbidden') return Errors.forbidden('DLQ item belongs to another agent');
    return { kind: 'ok' as const, data: serialize(item as IDlqItem) };
  }

  const url = new URL(ctx.req.url);
  const filter: Record<string, unknown> = { tenantId, agentId };
  const status = url.searchParams.get('status');
  if (status) filter.status = status;
  const wf = url.searchParams.get('workflow_id');
  if (wf) filter.workflowId = wf;
  const op = url.searchParams.get('operation');
  if (op) filter.operation = op;
  const src = url.searchParams.get('source');
  if (src) filter.source = src;

  const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (cursor?._id) filter._id = { $lt: new (await import('mongoose')).default.Types.ObjectId(String(cursor._id)) };

  const rows = await DlqItem.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = (hasMore ? rows.slice(0, limit) : rows) as IDlqItem[];
  const nextCursor = hasMore && slice.length ? encodeCursor({ _id: String(slice[slice.length - 1]._id) }) : undefined;
  return { kind: 'list' as const, data: slice.map((e) => serialize(e, false)), cursor: nextCursor ?? '', has_more: hasMore };
});

// ── POST /v1/dlq/{id}/claim ──────────────────────────────────────────────────
export async function POST_claim(ctx: import('@/lib/v2/route').RouteContext<{ id?: string[] }>) {
  const id = Array.isArray(ctx.params.id) && ctx.params.id.length ? ctx.params.id[0] : '';
  const tenantId = ctx.resolved.tenantId;
  const agentId = ctx.resolved.agentId;
  const item = await DlqItem.findOne({ dlqId: id }).lean();
  const owner = isOwner(item as IDlqItem | null, tenantId, agentId);
  if (owner === 'notfound') return Errors.dlqNotFound();
  if (owner === 'forbidden') return Errors.forbidden('DLQ item belongs to another agent');

  const e = item as IDlqItem;
  if (e.status === 'resolved' || e.status === 'archived') return Errors.dlqAlreadyResolved();

  const body = (ctx.body ?? {}) as { lock_seconds?: number };
  const lockSeconds = Number(body.lock_seconds ?? 300);
  if (!Number.isFinite(lockSeconds) || lockSeconds < 1 || lockSeconds > 86400) {
    return Errors.validation('lock_seconds must be 1..86400', { field: 'lock_seconds' });
  }
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + lockSeconds * 1000);

  // Atomic claim: only if status=failed OR (claimed AND lock expired).
  const claimed = await DlqItem.findOneAndUpdate(
    {
      dlqId: id,
      $or: [{ status: 'failed' }, { status: 'claimed', lockedUntil: { $lte: now } }],
    },
    {
      $set: { status: 'claimed', lockedUntil, lockedBy: agentId, lastAttemptedAt: now, failedAt: now },
      $inc: { attemptCount: 1 },
    },
    { returnDocument: "after" },
  ).lean();

  if (!claimed) {
    // Either locked by someone else, or already resolved — re-check.
    const fresh = await DlqItem.findOne({ dlqId: id }).lean() as IDlqItem | null;
    if (fresh && (fresh.status === 'resolved' || fresh.status === 'archived')) return Errors.dlqAlreadyResolved();
    if (fresh && fresh.lockedUntil) return Errors.dlqLocked(fresh.lockedUntil.toISOString());
    return Errors.dlqNotFound();
  }

  return {
    kind: 'ok' as const,
    data: {
      id: claimed.dlqId,
      status: claimed.status,
      attempt_count: claimed.attemptCount,
      last_attempted_at: claimed.lastAttemptedAt ? claimed.lastAttemptedAt.toISOString() : null,
      locked_until: claimed.lockedUntil ? claimed.lockedUntil.toISOString() : null,
    },
  };
}

// ── POST /v1/dlq/{id}/release ────────────────────────────────────────────────
export async function POST_release(ctx: import('@/lib/v2/route').RouteContext<{ id?: string[] }>) {
  const id = Array.isArray(ctx.params.id) && ctx.params.id.length ? ctx.params.id[0] : '';
  const tenantId = ctx.resolved.tenantId;
  const agentId = ctx.resolved.agentId;
  const item = await DlqItem.findOne({ dlqId: id }).lean();
  const owner = isOwner(item as IDlqItem | null, tenantId, agentId);
  if (owner === 'notfound') return Errors.dlqNotFound();
  if (owner === 'forbidden') return Errors.forbidden('DLQ item belongs to another agent');

  const body = (ctx.body ?? {}) as { reason?: string };
  const updated = await DlqItem.findOneAndUpdate(
    { dlqId: id, status: 'claimed' },
    {
      $set: { status: 'failed', lockedUntil: null, lockedBy: null, failedAt: new Date(), lastError: { reason: body.reason ?? null, at: new Date().toISOString() } },
    },
    { returnDocument: "after" },
  ).lean() as IDlqItem | null;
  if (!updated) {
    const fresh = await DlqItem.findOne({ dlqId: id }).lean() as IDlqItem | null;
    if (fresh && (fresh.status === 'resolved' || fresh.status === 'archived')) return Errors.dlqAlreadyResolved();
    return Errors.conflict('DLQ item is not claimed');
  }
  return { kind: 'ok' as const, data: { id: updated.dlqId, status: updated.status } };
}

// ── POST /v1/dlq/{id}/fail ───────────────────────────────────────────────────
export async function POST_fail(ctx: import('@/lib/v2/route').RouteContext<{ id?: string[] }>) {
  const id = Array.isArray(ctx.params.id) && ctx.params.id.length ? ctx.params.id[0] : '';
  const tenantId = ctx.resolved.tenantId;
  const agentId = ctx.resolved.agentId;
  const item = await DlqItem.findOne({ dlqId: id }).lean();
  const owner = isOwner(item as IDlqItem | null, tenantId, agentId);
  if (owner === 'notfound') return Errors.dlqNotFound();
  if (owner === 'forbidden') return Errors.forbidden('DLQ item belongs to another agent');

  const body = (ctx.body ?? {}) as { error?: { type?: string; message?: string; code?: string }; next_retry_after?: string };
  const updated = await DlqItem.findOneAndUpdate(
    { dlqId: id, status: { $in: ['claimed', 'failed'] } },
    {
      $set: {
        status: 'failed',
        lockedUntil: null,
        lockedBy: null,
        failedAt: new Date(),
        lastError: body.error ?? null,
        nextRetryAfter: body.next_retry_after ? new Date(body.next_retry_after) : null,
      },
    },
    { returnDocument: "after" },
  ).lean() as IDlqItem | null;
  if (!updated) {
    const fresh = await DlqItem.findOne({ dlqId: id }).lean() as IDlqItem | null;
    if (fresh && (fresh.status === 'resolved' || fresh.status === 'archived')) return Errors.dlqAlreadyResolved();
    return Errors.conflict('DLQ item is not in a failable state');
  }
  return { kind: 'ok' as const, data: serialize(updated) };
}

// ── POST /v1/dlq/{id}/resolve ────────────────────────────────────────────────
export async function POST_resolve(ctx: import('@/lib/v2/route').RouteContext<{ id?: string[] }>) {
  const id = Array.isArray(ctx.params.id) && ctx.params.id.length ? ctx.params.id[0] : '';
  const tenantId = ctx.resolved.tenantId;
  const agentId = ctx.resolved.agentId;
  const item = await DlqItem.findOne({ dlqId: id }).lean();
  const owner = isOwner(item as IDlqItem | null, tenantId, agentId);
  if (owner === 'notfound') return Errors.dlqNotFound();
  if (owner === 'forbidden') return Errors.forbidden('DLQ item belongs to another agent');

  const body = (ctx.body ?? {}) as { resolution?: string; result?: unknown };
  const updated = await DlqItem.findOneAndUpdate(
    { dlqId: id, status: { $in: ['failed', 'claimed'] } },
    {
      $set: {
        status: 'resolved',
        lockedUntil: null,
        lockedBy: null,
        resolvedAt: new Date(),
        resolvedBy: agentId,
        result: { resolution: body.resolution ?? null, ...(body.result ? { result: body.result } : {}) },
      },
    },
    { returnDocument: "after" },
  ).lean() as IDlqItem | null;
  if (!updated) {
    const fresh = await DlqItem.findOne({ dlqId: id }).lean() as IDlqItem | null;
    if (fresh && (fresh.status === 'resolved' || fresh.status === 'archived')) return Errors.dlqAlreadyResolved();
    return Errors.conflict('DLQ item cannot be resolved in current state');
  }
  return { kind: 'ok' as const, data: serialize(updated) };
}

// ── DELETE /v1/dlq/{id} ──────────────────────────────────────────────────────
export const DELETE = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const id = Array.isArray(ctx.params.id) && ctx.params.id.length ? ctx.params.id[0] : '';
  const item = await DlqItem.findOne({ dlqId: id }).lean();
  const owner = isOwner(item as IDlqItem | null, ctx.resolved.tenantId, ctx.resolved.agentId);
  if (owner === 'notfound') return Errors.dlqNotFound();
  if (owner === 'forbidden') return Errors.forbidden('DLQ item belongs to another agent');

  const updated = await DlqItem.findOneAndUpdate(
    { dlqId: id, status: { $ne: 'archived' } },
    { $set: { status: 'archived', archivedAt: new Date(), lockedUntil: null, lockedBy: null } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return Errors.dlqAlreadyResolved();
  return { kind: 'noContent' as const };
});
