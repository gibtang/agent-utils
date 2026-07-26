/**
 * GET /api/c/{id}?t=ct_... — public Confession view endpoint for the review page.
 *
 * The token (scope `view`) is the only auth. No token / invalid token → 401.
 * Returns the confession's reviewer-visible fields (title, summary, urgency,
 * expiry) but NOT the agent's private context. The resolve scope is verified
 * separately at /v1/confessions/{id}/resolve (single-use).
 */
import { NextRequest } from 'next/server';
import { ok, errorResponse } from '@/lib/v2/envelope';
import { Errors, isApiError } from '@/lib/v2/errors';
import { verifyConfessionToken } from '@/lib/v2/confessionTokens';
import Confession, { type IConfession } from '@/models/v2/Confession';

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }): Promise<Response> {
  const p = params && typeof (params as { then?: unknown }).then === 'function'
    ? await (params as Promise<{ id: string }>)
    : (params as { id: string });
  const id = p.id;
  const requestId = req.headers.get('x-request-id') || '';
  const token = new URL(req.url).searchParams.get('t') || req.headers.get('x-confession-token');
  if (!token) return errorResponse(Errors.confessionTokenInvalid(), { request_id: requestId || undefined });

  const verified = await verifyConfessionToken(token);
  if (isApiError(verified)) return errorResponse(verified, { request_id: requestId || undefined });
  if (verified.confessionId !== id) return errorResponse(Errors.confessionTokenInvalid(), { request_id: requestId || undefined });

  const c = (await Confession.findOne({ confessionId: id }).lean()) as IConfession | null;
  if (!c || c.tenantId !== verified.tenantId) {
    return errorResponse(Errors.notFound('confession not found'), { request_id: requestId || undefined });
  }

  const canResolve = verified.scope === 'resolve' && c.status === 'pending' && !verified.token.usedAt;
  return ok({
    id: c.confessionId,
    title: c.title,
    summary: c.summary ?? null,
    urgency: c.urgency,
    status: c.status,
    requesting_agent: c.agentId,
    expires_at: c.expiresAt instanceof Date ? c.expiresAt.toISOString() : c.expiresAt,
    can_resolve: canResolve,
    token_scope: verified.scope,
    // context is intentionally omitted — agent-internal data is not reviewer-visible.
  }, { request_id: requestId || undefined });
}
