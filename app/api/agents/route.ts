import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/auth';
import { createAgent } from '@/lib/connections/service';
import { connectDB } from '@/lib/core/db';
import { resourceId } from '@/lib/core/ids';
import { DomainError, Errors } from '@/lib/core/errors';
import { failure, success } from '@/lib/core/envelope';
import { consume, RATE_LIMIT_POLICIES, rateLimitHeaders } from '@/lib/core/rate-limit';
import Agent from '@/models/Agent';
async function owner(request: NextRequest) { const actor = await requireOwner(request); const rate = await consume({ scope: 'owner', identifier: actor.accountId }, RATE_LIMIT_POLICIES.OWNER.limit, RATE_LIMIT_POLICIES.OWNER.windowSeconds); if (!rate.allowed) throw Errors.planLimitReached(); return { actor, headers: rateLimitHeaders(rate) }; }
function respond(error: unknown, requestId: string) { const e = error instanceof DomainError ? error : Errors.temporarilyUnavailable(); return NextResponse.json(failure(e, requestId).body, { status: e.http }); }
export async function GET(request: NextRequest) { const requestId = resourceId('req_'); try { const { actor, headers } = await owner(request); await connectDB(); const agents = await Agent.find({ accountId: actor.accountId, status: { $ne: 'deleted' } }).sort({ createdAt: 1 }).lean(); return NextResponse.json(success(agents.map(a => ({ agentId: a.agentId, accountId: a.accountId, name: a.name, status: a.status, createdAt: a.createdAt })), requestId, { headers }).body, { headers }); } catch (e) { return respond(e, requestId); } }
export async function POST(request: NextRequest) { const requestId = resourceId('req_'); try { const { actor, headers } = await owner(request); const data = await createAgent(actor, await request.json()); return NextResponse.json(success(data, requestId, { status: 201, headers }).body, { status: 201, headers }); } catch (e) { return respond(e, requestId); } }
