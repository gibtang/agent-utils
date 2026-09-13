import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/auth'; import Activity from '@/models/Activity'; import { resourceId } from '@/lib/core/ids'; import { DomainError, Errors } from '@/lib/core/errors'; import { failure, success } from '@/lib/core/envelope'; import { consume, RATE_LIMIT_POLICIES, rateLimitHeaders } from '@/lib/core/rate-limit';
const PROJECTION = { event: 1, metadata: 1, createdAt: 1, _id: 0 };
/**
 * GET /api/handoffs/[id]/activity — owner audit feed for ONE handoff.
 *
 * Existence-hidden: a handoffId the owner does not own (or a mistyped one)
 * yields the same empty 200 list as an owned handoff with no events — no 404
 * probing oracle for other owners' handoff ids. The projection is an explicit
 * allowlist (event, metadata, createdAt): Activity stores metadata-only audit
 * events by design, and the allowlist guarantees no future field (or stray
 * write) can leak into this response. There is deliberately no owner decrypt
 * surface anywhere.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = resourceId('req_');
  try {
    const actor = await requireOwner(request);
    const rate = await consume({ scope: 'owner', identifier: actor.accountId }, RATE_LIMIT_POLICIES.OWNER.limit, RATE_LIMIT_POLICIES.OWNER.windowSeconds);
    if (!rate.allowed) throw Errors.planLimitReached();
    const { id } = await params;
    const rows = await Activity.find({ accountId: actor.accountId, handoffId: id }).sort({ createdAt: 1 }).select(PROJECTION).lean();
    const data = rows.map((row) => ({ event: row.event, metadata: row.metadata, createdAt: row.createdAt.toISOString() }));
    const headers = rateLimitHeaders(rate);
    return NextResponse.json(success(data, requestId, { headers }).body, { headers });
  } catch (error) { const e = error instanceof DomainError ? error : Errors.temporarilyUnavailable(); return NextResponse.json(failure(e, requestId).body, { status: e.http }); }
}
