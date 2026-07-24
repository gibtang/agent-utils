import type { NextRequest } from 'next/server';
import { requireApprovalOrAdmin } from '@/lib/v2/auth';
import { Errors, ApiError } from '@/lib/v2/errors';
import { errorResponse, ok } from '@/lib/v2/envelope';
import Confession, { type IConfession } from '@/models/v2/Confession';
import { deliverConfessionCallback } from '@/lib/v2/confessions';
function serialize(c: IConfession) { return { id: c.confessionId, status: c.status, guidance: c.guidance, action: c.action, resolved_by: c.resolvedBy, resolved_at: c.resolvedAt?.toISOString() }; }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }): Promise<Response> {
  const requestId = req.headers.get('x-request-id') || ''; const auth = await requireApprovalOrAdmin(req);
  if (auth instanceof ApiError) return errorResponse(auth, { request_id: requestId || undefined });
  const { id } = await ctx.params;
  let body: { guidance?: unknown; action?: unknown }; try { body = await req.json(); } catch { return errorResponse(Errors.validation('Invalid JSON body'), { request_id: requestId || undefined }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse(Errors.validation('JSON body must be an object'), { request_id: requestId || undefined });
  if (typeof body.guidance !== 'string' || !body.guidance.trim() || body.guidance.length > 4096) return errorResponse(Errors.validation('guidance required, max 4096 chars', { field: 'guidance' }), { request_id: requestId || undefined });
  if (!['continue', 'pivot', 'abort'].includes(String(body.action))) return errorResponse(Errors.validation('action must be continue, pivot, or abort', { field: 'action' }), { request_id: requestId || undefined });
  const existing = await Confession.findOne({ confessionId: id, tenantId: auth.resolved.tenantId }).lean();
  if (!existing) return errorResponse(Errors.notFound('confession not found'), { request_id: requestId || undefined });
  const updated = await Confession.findOneAndUpdate({ confessionId: id, tenantId: auth.resolved.tenantId, status: 'open' }, { $set: { status: 'resolved', guidance: body.guidance.trim(), action: body.action, resolvedBy: auth.resolved.kind === 'admin' ? 'admin' : 'approval-proxy', resolvedAt: new Date() } }, { returnDocument: 'after' }).lean() as IConfession | null;
  if (!updated) return errorResponse(Errors.conflict('Confession already resolved'), { request_id: requestId || undefined });
  await deliverConfessionCallback(updated, 'confession.resolved');
  return ok(serialize(updated), { request_id: requestId || undefined });
}
