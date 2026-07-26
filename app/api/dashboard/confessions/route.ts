/**
 * Dashboard Confessions inbox — browser-authenticated (Firebase ID token).
 *
 * GET /api/dashboard/confessions — list the tenant's confessions (Open Confessions
 * inbox). Defaults to status=pending; other statuses supported via ?status=.
 * Supports cursor pagination. Agent context is NOT returned (it is agent-private).
 */
import type { NextRequest } from 'next/server';
import { errorResponse, ok } from '@/lib/v2/envelope';
import { Errors } from '@/lib/v2/errors';
import { verifyUser } from '@/lib/auth-session';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';
import Confession, { type IConfession } from '@/models/v2/Confession';

export async function GET(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return errorResponse(Errors.missingAuth());

  const url = new URL(req.url);
  const status = url.searchParams.get('status'); // 'pending' | 'resolved' | 'cancelled' | 'expired'
  const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
  const cursor = decodeCursor(url.searchParams.get('cursor'));

  const filter: Record<string, unknown> = { tenantId: user.tenantId };
  if (status) filter.status = status;
  if (cursor?._id) filter._id = { $lt: new (await import('mongoose')).default.Types.ObjectId(String(cursor._id)) };

  const rows = await Confession.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = (hasMore ? rows.slice(0, limit) : rows) as IConfession[];
  const nextCursor = hasMore && slice.length ? encodeCursor({ _id: String(slice[slice.length - 1]._id) }) : undefined;

  const data = slice.map((c) => ({
    id: c.confessionId,
    title: c.title,
    summary: c.summary ?? null,
    urgency: c.urgency,
    status: c.status,
    requesting_agent: c.agentId,
    reviewer_email: c.reviewerEmail ?? null,
    escalated: !!c.escalatedAt,
    expires_at: c.expiresAt instanceof Date ? c.expiresAt.toISOString() : c.expiresAt,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    ...(c.resolutionDecision
      ? {
          resolution: {
            decision: c.resolutionDecision,
            by: c.resolutionBy,
            note: c.resolutionNote,
            resolved_at: c.resolvedAt instanceof Date ? c.resolvedAt.toISOString() : c.resolvedAt,
          },
        }
      : {}),
  }));

  return ok(data, { cursor: nextCursor ?? '', has_more: hasMore });
}
