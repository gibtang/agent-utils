/**
 * HitL Checkpoint routes (PRD §12).
 *   POST   /v1/checkpoints
 *   GET    /v1/checkpoints
 *   GET    /v1/checkpoints/{id}
 *   POST   /v1/checkpoints/{id}/approve   (admin OR approval-proxy)
 *   POST   /v1/checkpoints/{id}/reject    (admin OR approval-proxy)
 *   DELETE /v1/checkpoints/{id}           (agent cancels own)
 */
import { createRoute, type RouteContext } from '@/lib/v2/route';
import { Errors, ApiError } from '@/lib/v2/errors';
import { ok, errorResponse, noContent } from '@/lib/v2/envelope';
import { resolveCredentials, requireAgentKey, requireApprovalOrAdmin } from '@/lib/v2/auth';
import { resourceId } from '@/lib/v2/ids';
import Checkpoint, { CheckpointStatus, TimeoutAction } from '@/models/v2/Checkpoint';
import { reserveCountedQuota, releaseCountedQuota } from '@/lib/v2/quota';
import { validateCallbackUrl } from '@/lib/v2/callbackSecurity';
import { applyResolution } from '@/lib/v2/hitl';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';

const HTTPS_RE = /^https:\/\//i;
const CONTEXT_MAX = 50 * 1024;
const PAYLOAD_MAX = 100 * 1024;
const MIN_EXPIRES = 300;
const MAX_EXPIRES = 604800;
const DEFAULT_EXPIRES = 86400;
const RETENTION_DAYS = 30;

function utf8Bytes(s: string): number {
  return typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : new TextEncoder().encode(s).length;
}

function serialize(c: any) {
  return {
    id: c.checkpointId,
    agent_id: c.agentId,
    title: c.title,
    description: c.description ?? null,
    context: c.context ?? null,
    status: c.status,
    expires_at: c.expiresAt instanceof Date ? c.expiresAt.toISOString() : c.expiresAt,
    timeout_action: c.timeoutAction,
    callback_url: c.callbackUrl,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    ...(c.status !== 'pending' && c.resolutionDecision
      ? {
          resolution: {
            decision: c.resolutionDecision,
            by: c.resolutionBy,
            note: c.resolutionNote,
            resolved_at: c.resolvedAt instanceof Date ? c.resolvedAt.toISOString() : c.resolvedAt,
          },
        }
      : {}),
  };
}

function idFromParams(params: { id?: string[] }): string {
  return Array.isArray(params.id) && params.id.length ? params.id[0] : '';
}

// ── POST ─────────────────────────────────────────────────────────────────────
export const POST = createRoute({ agentKey: true, idempotent: 'POST /v1/checkpoints' }, async (ctx) => {
  const body = (ctx.body ?? {}) as {
    title?: string;
    description?: string;
    context?: unknown;
    expires_in_seconds?: number;
    timeout_action?: string;
    callback_url?: string;
    callback_payload?: unknown;
  };
  if (!body.title || body.title.length > 256) {
    return Errors.validation('title required, max 256 chars', { field: 'title' });
  }
  if (body.description && body.description.length > 4096) {
    return Errors.validation('description max 4096 chars', { field: 'description' });
  }
  if (body.context !== undefined && body.context !== null && utf8Bytes(JSON.stringify(body.context)) > CONTEXT_MAX) {
    return Errors.payloadTooLarge('context max 50KB');
  }
  if (!body.callback_url || !HTTPS_RE.test(body.callback_url) || body.callback_url.length > 2048) {
    return Errors.validation('callback_url must be a valid HTTPS URL', { field: 'callback_url' });
  }
  // R-HITL-8: reject auto_approve
  if (body.timeout_action && !['auto_reject', 'dlq'].includes(body.timeout_action)) {
    return Errors.validation('timeout_action must be "auto_reject" or "dlq" (auto_approve is not allowed)', { field: 'timeout_action' });
  }
  const expiresIn = body.expires_in_seconds ?? DEFAULT_EXPIRES;
  if (!Number.isFinite(expiresIn) || expiresIn < MIN_EXPIRES || expiresIn > MAX_EXPIRES) {
    return Errors.validation('expires_in_seconds must be 300..604800', { field: 'expires_in_seconds' });
  }
  if (body.callback_payload !== undefined && body.callback_payload !== null && utf8Bytes(JSON.stringify(body.callback_payload)) > PAYLOAD_MAX) {
    return Errors.payloadTooLarge('callback_payload max 100KB');
  }

  // SSRF-validate callback URL (PRD §6.2).
  const urlCheck = await validateCallbackUrl(body.callback_url);
  if (!urlCheck.ok) return urlCheck.error!;

  // Quota (atomic).
  const q = await reserveCountedQuota(ctx.resolved.tenantId, ctx.resolved.plan, 'pendingCheckpointCount', 'checkpointsPending');
  if (!q.ok) return Errors.quotaExceeded('checkpoints_pending', q.used, q.limit);

  const checkpointId = resourceId('hitl_');
  const now = new Date();
  try {
    const cp = await Checkpoint.create({
      checkpointId,
      tenantId: ctx.resolved.tenantId,
      agentId: ctx.resolved.agentId,
      title: body.title,
      description: body.description ?? null,
      context: body.context ?? null,
      status: 'pending',
      expiresAt: new Date(now.getTime() + expiresIn * 1000),
      timeoutAction: (body.timeout_action as TimeoutAction) ?? 'auto_reject',
      callbackUrl: body.callback_url,
      callbackPayload: body.callback_payload ?? null,
      expiresAtPurge: new Date(now.getTime() + RETENTION_DAYS * 86400_000),
    });
    return { kind: 'created' as const, data: serialize(cp) };
  } catch (e) {
    await releaseCountedQuota(ctx.resolved.tenantId, 'pendingCheckpointCount');
    throw e;
  }
});

// ── GET (list + single) ──────────────────────────────────────────────────────
export const GET = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const id = idFromParams(ctx.params);
  const tenantId = ctx.resolved.tenantId;

  if (id) {
    const c = await Checkpoint.findOne({ checkpointId: id }).lean() as any;
    if (!c || c.tenantId !== tenantId) return Errors.notFound('checkpoint not found');
    return { kind: 'ok' as const, data: serialize(c) };
  }

  const url = new URL(ctx.req.url);
  const filter: Record<string, unknown> = { tenantId };
  const status = url.searchParams.get('status') as CheckpointStatus | null;
  if (status) filter.status = status;
  const agentId = url.searchParams.get('agent_id');
  if (agentId) filter.agentId = agentId;
  const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (cursor?._id) filter._id = { $lt: new (await import('mongoose')).default.Types.ObjectId(String(cursor._id)) };

  const rows = await Checkpoint.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = (hasMore ? rows.slice(0, limit) : rows) as any[];
  const nextCursor = hasMore && slice.length ? encodeCursor({ _id: String(slice[slice.length - 1]._id) }) : undefined;
  return { kind: 'list' as const, data: slice.map(serialize), cursor: nextCursor ?? '', has_more: hasMore };
});

// ── approve / reject (admin OR approval-proxy) ──────────────────────────────
async function resolveRoute(
  req: import('next/server').NextRequest,
  params: { id?: string[] } | Promise<{ id?: string[] }>,
  decision: 'approved' | 'rejected',
): Promise<Response> {
  const p = (typeof (params as any)?.then === 'function' ? await (params as Promise<{ id?: string[] }>) : params as { id?: string[] });
  const requestId = req.headers.get('x-request-id') || '';
  const resolution = await requireApprovalOrAdmin(req);
  if (resolution instanceof ApiError) return errorResponse(resolution, { request_id: requestId || undefined });
  const resolved = resolution.resolved;
  const id = idFromParams(p);

  let parsed: { by?: string; note?: string };
  try {
    const text = await req.text();
    const parsedRaw = text ? JSON.parse(text) : {};
    parsed = typeof parsedRaw === 'object' && parsedRaw !== null ? parsedRaw : {};
  } catch {
    parsed = {};
  }
  if (!parsed.by || parsed.by.length > 128) {
    return errorResponse(Errors.validation('by required, max 128 chars', { field: 'by' }), { request_id: requestId || undefined });
  }
  if (parsed.note && parsed.note.length > 1024) {
    return errorResponse(Errors.validation('note max 1024 chars', { field: 'note' }), { request_id: requestId || undefined });
  }

  // Checkpoint must exist in this tenant. Cross-tenant → 404 (R-HITL-6).
  const cp = await Checkpoint.findOne({ checkpointId: id }).lean() as any;
  if (!cp || cp.tenantId !== resolved.tenantId) {
    return errorResponse(Errors.notFound('checkpoint not found'), { request_id: requestId || undefined });
  }
  if (cp.status !== 'pending') {
    return errorResponse(Errors.checkpointAlreadyResolved(), { request_id: requestId || undefined });
  }

  // release pending-checkpoint quota
  await releaseCountedQuota(resolved.tenantId, 'pendingCheckpointCount');

  const res = await applyResolution(id, resolved.tenantId, { decision, by: parsed.by, note: parsed.note ?? null });
  void res;

  const updated = await Checkpoint.findOne({ checkpointId: id }).lean() as any;
  return ok(serialize(updated), { request_id: requestId || undefined });
}

export const APPROVE = (req: import('next/server').NextRequest, params: { id?: string[] } | Promise<{ id?: string[] }>) =>
  resolveRoute(req, params, 'approved');
export const REJECT = (req: import('next/server').NextRequest, params: { id?: string[] } | Promise<{ id?: string[] }>) =>
  resolveRoute(req, params, 'rejected');

// ── DELETE (agent cancels own) ───────────────────────────────────────────────
export const DELETE = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const id = idFromParams(ctx.params);
  const c = await Checkpoint.findOne({ checkpointId: id }).lean() as any;
  if (!c || c.tenantId !== ctx.resolved.tenantId) return Errors.notFound('checkpoint not found');
  // R-HITL-4: only creating agent may cancel.
  if (c.agentId !== ctx.resolved.agentId) return Errors.forbidden('Only the creating agent may cancel');
  if (c.status !== 'pending') return Errors.conflict('Checkpoint already resolved');
  const updated = await Checkpoint.findOneAndUpdate(
    { checkpointId: id, status: 'pending' },
    { $set: { status: 'cancelled', resolvedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return Errors.conflict('Checkpoint already resolved');
  await releaseCountedQuota(ctx.resolved.tenantId, 'pendingCheckpointCount');
  return { kind: 'noContent' as const };
});
