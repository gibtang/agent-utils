import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';
import Confession, { type IConfession, type ConfessionStatus } from '@/models/v2/Confession';
const id = (p: { id?: string[] }) => p.id?.[0] ?? '';
function serialize(c: IConfession) { return { id: c.confessionId, agent_id: c.agentId, summary: c.summary, concerns: c.concerns, confidence: c.confidence, context: c.context, urgency: c.urgency, blocking: c.blocking, ...(c.blocking && c.status === 'open' ? { poll_after_seconds: 5 } : {}), status: c.status, expires_at: c.expiresAt.toISOString(), timeout_action: c.timeoutAction, callback_url: c.callbackUrl, created_at: c.createdAt?.toISOString(), ...(c.status === 'resolved' ? { guidance: c.guidance, action: c.action, resolved_by: c.resolvedBy, resolved_at: c.resolvedAt?.toISOString() } : {}) }; }
export const GET = createRoute<{ id?: string[] }>({ agentKey: true }, async ctx => {
  const confessionId = id(ctx.params); if (confessionId) { const c = await Confession.findOne({ confessionId, tenantId: ctx.resolved.tenantId }).lean() as IConfession | null; return c ? { kind: 'ok' as const, data: serialize(c) } : Errors.notFound('confession not found'); }
  const url = new URL(ctx.req.url), filter: Record<string, unknown> = { tenantId: ctx.resolved.tenantId }, status = url.searchParams.get('status');
  if (status && !['open','resolved','expired'].includes(status)) return Errors.validation('invalid status', { field: 'status' }); if (status) filter.status = status as ConfessionStatus; const agent = url.searchParams.get('agent_id'); if (agent) filter.agentId = agent;
  const cursor = decodeCursor(url.searchParams.get('cursor')); if (cursor?._id) { const mongoose = (await import('mongoose')).default; filter._id = { $lt: new mongoose.Types.ObjectId(String(cursor._id)) }; }
  const limit = clampLimit(url.searchParams.get('limit'), 20, 100), rows = await Confession.find(filter).sort({ _id: -1 }).limit(limit + 1).lean() as IConfession[], more = rows.length > limit, slice = more ? rows.slice(0, limit) : rows;
  return { kind: 'list' as const, data: slice.map(serialize), cursor: more ? encodeCursor({ _id: String(slice.at(-1)!._id) }) : '', has_more: more };
});
