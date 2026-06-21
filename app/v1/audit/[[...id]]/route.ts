/**
 * Audit Log routes (PRD §11).
 *   POST /v1/audit            — write entry (server timestamp, immutable)
 *   GET  /v1/audit            — list w/ filters
 *   GET  /v1/audit/{id}       — single entry
 *
 * Any authenticated agent within the tenant can read all entries (R-AL-5).
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { resourceId } from '@/lib/v2/ids';
import AuditLog from '@/models/v2/AuditLog';
import { quotaFor } from '@/lib/v2/quota';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';

const ACTION_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const PAYLOAD_MAX = 10 * 1024;

function utf8Bytes(s: string): number {
  return typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : new TextEncoder().encode(s).length;
}

export const POST = createRoute({ agentKey: true, idempotent: 'POST /v1/audit' }, async (ctx) => {
  const body = (ctx.body ?? {}) as {
    action?: string;
    resource_type?: string;
    resource_id?: string;
    payload?: unknown;
    metadata?: { workflow_id?: string; session_id?: string };
  };
  const action = body.action?.trim();
  if (!action || !ACTION_RE.test(action)) {
    return Errors.validation('action must be dot-namespaced, max 128 chars', { field: 'action' });
  }
  if (body.resource_type && body.resource_type.length > 64) {
    return Errors.validation('resource_type max 64 chars', { field: 'resource_type' });
  }
  if (body.resource_id && body.resource_id.length > 256) {
    return Errors.validation('resource_id max 256 chars', { field: 'resource_id' });
  }
  if (body.payload !== undefined && body.payload !== null && utf8Bytes(JSON.stringify(body.payload)) > PAYLOAD_MAX) {
    return Errors.payloadTooLarge('payload max 10KB');
  }

  const now = new Date();
  const retentionDays = quotaFor(ctx.resolved.plan).auditRetentionDays;
  const expiresAt = new Date(now.getTime() + retentionDays * 86400_000);
  const auditId = resourceId('log_');

  try {
    await AuditLog.create({
      auditId,
      tenantId: ctx.resolved.tenantId,
      agentId: ctx.resolved.agentId,
      action,
      resourceType: body.resource_type ?? null,
      resourceId: body.resource_id ?? null,
      payload: body.payload ?? null,
      metadata: body.metadata ?? null,
      timestamp: now,
      requestId: ctx.requestId || null,
      expiresAt,
    });
  } catch (e) {
    const err = e as { code?: number; message?: string };
    // Duplicate key from idempotency replay — surface as conflict-free: return id.
    if (err.code === 11000 || /E11000|duplicate/i.test(err.message || '')) {
      return Errors.conflict('audit entry collision — retry');
    }
    throw e;
  }

  return {
    kind: 'created' as const,
    data: {
      id: auditId,
      agent_id: ctx.resolved.agentId,
      action,
      timestamp: now.toISOString(),
    },
  };
});

function buildListFilter(tenantId: string, searchParams: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = { tenantId };
  const agentId = searchParams.get('agent_id');
  if (agentId) filter.agentId = agentId;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const ts: Record<string, Date> = {};
  if (from) ts.$gte = new Date(from);
  if (to) ts.$lt = new Date(to);
  if (Object.keys(ts).length) filter.timestamp = ts;
  const wf = searchParams.get('workflow_id');
  if (wf) filter['metadata.workflow_id'] = wf;
  return filter;
}

export const GET = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const url = new URL(ctx.req.url);
  const seg = ctx.params;
  // optional catch-all: id is string[] when present
  const idSeg = seg.id;
  const id = Array.isArray(idSeg) && idSeg.length ? idSeg[0] : undefined;
  const tenantId = ctx.resolved.tenantId;

  if (id) {
    const entry = await AuditLog.findOne({ tenantId, auditId: id }).lean();
    if (!entry) return Errors.notFound('audit entry not found');
    return { kind: 'ok' as const, data: serialize(entry) };
  }

  const filter = buildListFilter(tenantId, url.searchParams);
  const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
  const asc = url.searchParams.get('sort') === 'asc';
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  const mongoose = (await import('mongoose')).default;
  if (cursor?.ts && cursor?._id) {
    const cmp = asc ? '$gt' : '$lt';
    filter.$or = [
      { timestamp: { [cmp]: new Date(String(cursor.ts)) } },
      { timestamp: new Date(String(cursor.ts)), _id: { [cmp]: new mongoose.Types.ObjectId(String(cursor._id)) } },
    ];
  }

  const rows = await AuditLog.find(filter).sort({ timestamp: asc ? 1 : -1, _id: asc ? 1 : -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1] as any;
  const nextCursor = hasMore && last ? encodeCursor({ ts: last.timestamp instanceof Date ? last.timestamp.toISOString() : String(last.timestamp), _id: String(last._id) }) : undefined;

  return { kind: 'list' as const, data: slice.map(serialize), cursor: nextCursor ?? '', has_more: hasMore };
});

function serialize(e: any) {
  return {
    id: e.auditId,
    agent_id: e.agentId,
    action: e.action,
    resource_type: e.resourceType ?? null,
    resource_id: e.resourceId ?? null,
    payload: e.payload ?? null,
    metadata: e.metadata ?? null,
    timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp,
    request_id: e.requestId ?? null,
  };
}
