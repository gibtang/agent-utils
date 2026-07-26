/**
 * POST /v1/confessions/{id}/resolve — record a reviewer decision.
 *
 * Three auth paths (any one accepted):
 *   1. Magic-link token (`?t=ct_...` from the review email/page) — scope `resolve`,
 *      single-use. The token identifies the tenant + confession; no key needed.
 *   2. Tenant admin key (`X-Admin-Key: agutil_adm_...`).
 *   3. Approval-proxy key (`X-Approval-Key: agutil_apr_...`).
 *
 * Resolution cancels any pending notifications + escalations, fires the signed
 * `confession.resolved` callback, and cascades to DLQ on delivery failure.
 */
import { NextRequest } from 'next/server';
import Confession, { type IConfession } from '@/models/v2/Confession';
import { ok, errorResponse } from '@/lib/v2/envelope';
import { Errors, ApiError } from '@/lib/v2/errors';
import { requireApprovalOrAdmin } from '@/lib/v2/auth';
import { verifyConfessionToken } from '@/lib/v2/confessionTokens';
import { applyConfessionResolution } from '@/lib/v2/confessions';
import { serializeConfession } from '@/lib/v2/confessionsApi';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const requestId = req.headers.get('x-request-id') || '';

  // Parse decision/note (same shape as checkpoint approve/reject).
  let parsed: { decision?: string; note?: string; by?: string };
  try {
    const text = await req.text();
    const raw = text ? JSON.parse(text) : {};
    parsed = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return errorResponse(Errors.validation('Invalid JSON body'), { request_id: requestId || undefined });
  }

  const decision = parsed.decision;
  if (decision !== 'approved' && decision !== 'rejected') {
    return errorResponse(Errors.validation('decision must be "approved" or "rejected"', { field: 'decision' }), {
      request_id: requestId || undefined,
    });
  }
  if (parsed.note && parsed.note.length > 1024) {
    return errorResponse(Errors.validation('note max 1024 chars', { field: 'note' }), { request_id: requestId || undefined });
  }

  // ── Path 1: magic-link token ──────────────────────────────────────────────
  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get('t');
  const tokenFromHeader = req.headers.get('x-confession-token');
  const token = tokenFromQuery || tokenFromHeader;
  if (token) {
    const verified = await verifyConfessionToken(token, { consume: true });
    if (verified instanceof ApiError) {
      return errorResponse(verified, { request_id: requestId || undefined });
    }
    if (verified.confessionId !== id) {
      return errorResponse(Errors.confessionTokenInvalid(), { request_id: requestId || undefined });
    }
    // Token is valid for this confession — resolve.
    const c = (await Confession.findOne({ confessionId: id }).lean()) as IConfession | null;
    if (!c || c.tenantId !== verified.tenantId) {
      return errorResponse(Errors.notFound('confession not found'), { request_id: requestId || undefined });
    }
    if (c.status !== 'pending') {
      return errorResponse(Errors.confessionAlreadyResolved(), { request_id: requestId || undefined });
    }
    await applyConfessionResolution(id, c.tenantId, {
      decision,
      by: parsed.by && parsed.by.length <= 128 ? parsed.by : 'reviewer',
      note: parsed.note ?? null,
    }, { requestId: requestId || undefined });
    const updated = (await Confession.findOne({ confessionId: id }).lean()) as IConfession | null;
    if (!updated) return errorResponse(Errors.notFound('confession not found'), { request_id: requestId || undefined });
    return ok(serializeConfession(updated), { request_id: requestId || undefined });
  }

  // ── Path 2/3: admin key OR approval-proxy key ─────────────────────────────
  const resolution = await requireApprovalOrAdmin(req);
  if (resolution instanceof ApiError) return errorResponse(resolution, { request_id: requestId || undefined });
  const resolved = resolution.resolved;

  const c = (await Confession.findOne({ confessionId: id }).lean()) as IConfession | null;
  if (!c || c.tenantId !== resolved.tenantId) {
    return errorResponse(Errors.notFound('confession not found'), { request_id: requestId || undefined });
  }
  if (c.status !== 'pending') {
    return errorResponse(Errors.confessionAlreadyResolved(), { request_id: requestId || undefined });
  }
  if (!parsed.by || parsed.by.length > 128) {
    return errorResponse(Errors.validation('by required, max 128 chars', { field: 'by' }), { request_id: requestId || undefined });
  }

  await applyConfessionResolution(id, resolved.tenantId, {
    decision,
    by: parsed.by,
    note: parsed.note ?? null,
  }, { requestId: requestId || undefined });

  const updated = (await Confession.findOne({ confessionId: id }).lean()) as IConfession | null;
  if (!updated) return errorResponse(Errors.notFound('confession not found'), { request_id: requestId || undefined });
  return ok(serializeConfession(updated), { request_id: requestId || undefined });
}
