import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { DomainError, Errors } from '@/lib/core/errors';
import { failure, success } from '@/lib/core/envelope';
import { resourceId } from '@/lib/core/ids';
import { consume } from '@/lib/core/rate-limit';
import { submitHandoffValues } from '@/lib/handoff/service';
import { hashHandoffToken } from '@/lib/handoff/crypto';
import Activity from '@/models/Activity';
import Handoff from '@/models/Handoff';

const HANDOFF_SUBMIT_IP_POLICY = { limit: 10, windowSeconds: 3600 } as const;
const HANDOFF_SUBMIT_HANDOFF_POLICY = { limit: 20, windowSeconds: 3600 } as const;
const hashIp = (ip: string) => createHash('sha256').update(ip).digest('hex');
async function activity(handoffId: string, event: string) {
  const handoff = await Handoff.findOne({ handoffId }).select({ accountId: 1, agentId: 1, handoffId: 1, _id: 0 }).lean();
  if (handoff) await Activity.create({ accountId: handoff.accountId, agentId: handoff.agentId, handoffId: handoff.handoffId, event, metadata: { handoffId } });
}

export async function POST(request: Request) {
  const requestId = resourceId('req_');
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== 'object') throw Errors.validationFailed();
    const body = raw as Record<string, unknown>;
    const handoffId = typeof body.handoffId === 'string' ? body.handoffId : '';
    const token = typeof body.token === 'string' ? body.token : '';
    const website = typeof body.website === 'string' ? body.website : '';
    const values = body.values;
    if (!handoffId || !token || !values || typeof values !== 'object' || Array.isArray(values)) throw Errors.validationFailed();
    if (website) { await activity(handoffId, 'handoff.honeypot_tripped'); return NextResponse.json(success({ handoffId, status: 'submitted' }, requestId).body); }
    // Audit attempt metadata only; submitted values and IP plaintext are never logged.
    await activity(handoffId, 'handoff.submit_attempted');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; const ipHash = hashIp(ip);
    const ipRate = await consume({ scope: 'handoff_submit_ip', identifier: ipHash }, HANDOFF_SUBMIT_IP_POLICY.limit, HANDOFF_SUBMIT_IP_POLICY.windowSeconds);
    if (!ipRate.allowed) throw Errors.planLimitReached();
    const handoffRate = await consume({ scope: 'handoff_submit_handoff', identifier: handoffId }, HANDOFF_SUBMIT_HANDOFF_POLICY.limit, HANDOFF_SUBMIT_HANDOFF_POLICY.windowSeconds);
    if (!handoffRate.allowed) throw Errors.planLimitReached();
    const tokenHash = hashHandoffToken(token);
    const matched = await Handoff.exists({ handoffId, status: 'awaiting', $or: [{ viewTokenHash: tokenHash }, { submitTokenHash: tokenHash }] });
    if (!matched) throw Errors.notFound();
    const data = await submitHandoffValues(token, values as Record<string, string>, { ipHash });
    return NextResponse.json(success(data, requestId).body);
  } catch (error) {
    let e = error instanceof DomainError ? error : Errors.temporarilyUnavailable();
    if (e.code === 'validation_failed') e = new DomainError(e.code, e.message, 422, e.dataPreserved, e.retrySafe, e.nextAction, e.details);
    return NextResponse.json(failure(e, requestId).body, { status: e.http });
  }
}
