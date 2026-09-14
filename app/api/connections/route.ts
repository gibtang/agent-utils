import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/auth';
import { listConnections } from '@/lib/connections/service';
import { resourceId } from '@/lib/core/ids';
import { DomainError, Errors } from '@/lib/core/errors';
import { failure, success } from '@/lib/core/envelope';
import { consume, RATE_LIMIT_POLICIES, rateLimitHeaders } from '@/lib/core/rate-limit';

/** Owner-only connection list used by the dashboard to confirm pairing. */
export async function GET(request: NextRequest) {
  const requestId = resourceId('req_');
  try {
    const owner = await requireOwner(request);
    const rate = await consume(
      { scope: 'owner', identifier: owner.accountId },
      RATE_LIMIT_POLICIES.OWNER.limit,
      RATE_LIMIT_POLICIES.OWNER.windowSeconds,
    );
    if (!rate.allowed) throw Errors.planLimitReached();
    const data = await listConnections(owner);
    const headers = rateLimitHeaders(rate);
    return NextResponse.json(success(data, requestId, { headers }).body, { headers });
  } catch (error) {
    const e = error instanceof DomainError ? error : Errors.temporarilyUnavailable();
    return NextResponse.json(failure(e, requestId).body, { status: e.http });
  }
}
