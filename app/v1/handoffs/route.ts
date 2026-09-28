import { NextRequest, NextResponse } from 'next/server';
import { requireConnection } from '@/lib/connections/auth';
import { listHandoffs } from '@/lib/handoff/service';
import { getOperation } from '@/lib/contracts/registry';
import '@/lib/handoff/operations';
import { resourceId } from '@/lib/core/ids';
import { DomainError, Errors } from '@/lib/core/errors';
import { failure, success } from '@/lib/core/envelope';
import { consume, RATE_LIMIT_POLICIES, rateLimitHeaders } from '@/lib/core/rate-limit';

async function connection(request: NextRequest) { const actor = await requireConnection(request); const [one, account] = await Promise.all([consume({ scope: 'connection', identifier: actor.connectionId }, RATE_LIMIT_POLICIES.CONNECTION.limit, RATE_LIMIT_POLICIES.CONNECTION.windowSeconds), consume({ scope: 'connection_account', identifier: actor.accountId }, RATE_LIMIT_POLICIES.CONNECTION_PER_ACCOUNT.limit, RATE_LIMIT_POLICIES.CONNECTION_PER_ACCOUNT.windowSeconds)]); if (!one.allowed || !account.allowed) throw Errors.planLimitReached(); return { actor, headers: rateLimitHeaders({ remaining: Math.min(one.remaining, account.remaining), retryAfterSeconds: Math.max(one.retryAfterSeconds, account.retryAfterSeconds) }) }; }
const serialize = (row: Awaited<ReturnType<typeof listHandoffs>>[number]) => ({ ...row, createdAt: row.createdAt.toISOString(), lastRetrievedAt: row.lastRetrievedAt?.toISOString() ?? null, linkExpiresAt: row.linkExpiresAt.toISOString(), sessionExpiresAt: row.sessionExpiresAt.toISOString() });
function respond(error: unknown, requestId: string) { const e = error instanceof DomainError ? error : Errors.temporarilyUnavailable(); return NextResponse.json(failure(e, requestId).body, { status: e.http }); }
export async function POST(request: NextRequest) { const requestId = resourceId('req_'); try { const { actor, headers } = await connection(request); const parsed = getOperation('handoff_create')!.input.safeParse(await request.json()); if (!parsed.success) throw Errors.validationFailed(); const data = await getOperation('handoff_create')!.execute({ actor, requestId }, parsed.data); return NextResponse.json(success(data, requestId, { status: 201, headers }).body, { status: 201, headers }); } catch (error) { return respond(error, requestId); } }
export async function GET(request: NextRequest) { const requestId = resourceId('req_'); try { const { actor, headers } = await connection(request); const data = (await listHandoffs({ accountId: actor.accountId })).map(serialize); return NextResponse.json(success(data, requestId, { headers }).body, { headers }); } catch (error) { return respond(error, requestId); } }
