import type { NextRequest } from 'next/server';
import { requireApprovalOrAdmin } from '@/lib/v2/auth';
import { Errors, ApiError } from '@/lib/v2/errors';
import { errorResponse, ok } from '@/lib/v2/envelope';
import Confession, { type IConfession } from '@/models/v2/Confession';

function serialize(c: IConfession) {
  return {
    id: c.confessionId, agent_id: c.agentId, summary: c.summary, concerns: c.concerns,
    confidence: c.confidence, context: c.context, urgency: c.urgency, blocking: c.blocking,
    status: c.status, expires_at: c.expiresAt.toISOString(), timeout_action: c.timeoutAction,
    ...(c.status === 'resolved' ? { guidance: c.guidance, action: c.action, resolved_by: c.resolvedBy, resolved_at: c.resolvedAt?.toISOString() } : {}),
  };
}

/** Reviewer-only data fetch. The public /c/{id} shell deliberately renders no confession data. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }): Promise<Response> {
  const requestId = req.headers.get('x-request-id') || '';
  const auth = await requireApprovalOrAdmin(req);
  if (auth instanceof ApiError) return errorResponse(auth, { request_id: requestId || undefined });
  const { id } = await ctx.params;
  const confession = await Confession.findOne({ confessionId: id, tenantId: auth.resolved.tenantId }).lean() as IConfession | null;
  if (!confession) return errorResponse(Errors.notFound('confession not found'), { request_id: requestId || undefined });
  return ok(serialize(confession), { request_id: requestId || undefined });
}
