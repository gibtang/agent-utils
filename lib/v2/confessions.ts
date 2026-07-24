import Confession, { type IConfession } from '@/models/v2/Confession';
import DlqItem from '@/models/v2/DlqItem';
import Tenant from '@/models/v2/Tenant';
import { resourceId } from './ids';
import { deliverCallback, validateCallbackUrl } from './callbackSecurity';

const RETENTION_DAYS = 30;
const CLAIM_RECOVERY_MS = 5 * 60_000;

function callbackPayload(c: IConfession, event: string) {
  return { event, data: { id: c.confessionId, agent_id: c.agentId, summary: c.summary, concerns: c.concerns, confidence: c.confidence, context: c.context, urgency: c.urgency, blocking: c.blocking, status: c.status, guidance: c.guidance, action: c.action, timeout_action: c.timeoutAction, resolved_at: c.resolvedAt?.toISOString() } };
}

/** Best-effort, signed delivery. State changes remain successful if a remote webhook is unavailable. */
export async function deliverConfessionCallback(c: IConfession, event: 'confession.resolved' | 'confession.timed_out'): Promise<void> {
  if (!c.callbackUrl) return;
  const tenant = await Tenant.findOne({ tenantId: c.tenantId }).lean();
  if (!tenant) return;
  // Re-resolve immediately before this stored URL is delivered. A hostname that
  // was public at creation may later DNS-rebind to an internal address.
  const validation = await validateCallbackUrl(c.callbackUrl);
  const delivery = validation.ok
    ? await deliverCallback(c.callbackUrl, tenant.callbackSecret, event, callbackPayload(c, event), resourceId('del_'))
    : { ok: false, status: 0, statusText: 'callback URL failed delivery-time validation' };
  await Confession.updateOne({ confessionId: c.confessionId }, { $inc: { callbackAttempts: 1 }, $set: delivery.ok ? { callbackDeliveredAt: new Date(), callbackLastError: null } : { callbackLastError: `${delivery.status}: ${delivery.statusText}` } });
}

/**
 * Atomically reserve a timeout. A human response only transitions `open` to
 * `resolved`, so once this claim succeeds no concurrent human resolution can be
 * followed by a DLQ insertion. Abandoned claims are reclaimed after five minutes.
 */
async function claimTimeout(confessionId: string, now: Date): Promise<IConfession | null> {
  const claimId = resourceId('tclaim_');
  const recoveryBefore = new Date(now.getTime() - CLAIM_RECOVERY_MS);
  return await Confession.findOneAndUpdate(
    {
      confessionId,
      $or: [
        { status: 'open', expiresAt: { $lte: now } },
        { status: 'timeout_processing', timeoutClaimedAt: { $lte: recoveryBefore } },
      ],
    },
    { $set: { status: 'timeout_processing', timeoutClaimId: claimId, timeoutClaimedAt: now } },
    { returnDocument: 'after' },
  ).lean() as IConfession | null;
}

async function finishClaim(claim: IConfession, update: Record<string, unknown>): Promise<IConfession | null> {
  return await Confession.findOneAndUpdate(
    { confessionId: claim.confessionId, status: 'timeout_processing', timeoutClaimId: claim.timeoutClaimId },
    { $set: update },
    { returnDocument: 'after' },
  ).lean() as IConfession | null;
}

export async function processConfessionTimeouts(opts: { now?: Date; limit?: number } = {}): Promise<{ continued: number; aborted: number; dlqEscalated: number }> {
  const now = opts.now ?? new Date();
  const result = { continued: 0, aborted: 0, dlqEscalated: 0 };
  const recoveryBefore = new Date(now.getTime() - CLAIM_RECOVERY_MS);
  const due = await Confession.find({ $or: [{ status: 'open', expiresAt: { $lte: now } }, { status: 'timeout_processing', timeoutClaimedAt: { $lte: recoveryBefore } }] }).limit(opts.limit ?? 100).lean() as IConfession[];

  for (const candidate of due) {
    const claim = await claimTimeout(candidate.confessionId, now);
    if (!claim) continue;

    if (claim.timeoutAction === 'escalate_to_dlq') {
      try {
        // The unique source/sourceId index makes retry and crash recovery idempotent.
        const insertion = await DlqItem.updateOne(
          { source: 'confession', sourceId: claim.confessionId },
          { $setOnInsert: { dlqId: resourceId('dlq_'), tenantId: claim.tenantId, agentId: claim.agentId, workflowId: null, operation: 'confession.timeout', source: 'confession', sourceId: claim.confessionId, payload: { summary: claim.summary, concerns: claim.concerns, context: claim.context }, errorType: 'TIMEOUT', errorMessage: 'Confession expired and was escalated to DLQ', errorCode: 'CONFESSION_TIMEOUT', failedAt: now, status: 'failed', attemptCount: 0, maxAttempts: 5, expiresAt: new Date(now.getTime() + RETENTION_DAYS * 86400_000) } },
          { upsert: true },
        );
        if (insertion.upsertedCount) await Tenant.updateOne({ tenantId: claim.tenantId }, { $inc: { dlqItemCount: 1 } });
        const expired = await finishClaim(claim, { status: 'expired', resolvedBy: 'system', resolvedAt: now, timeoutClaimId: null, timeoutClaimedAt: null });
        if (expired) {
          result.dlqEscalated++;
          await deliverConfessionCallback(expired, 'confession.timed_out');
        }
      } catch {
        // Retain the claim for recovery. A later tick reclaims it; no record is stuck.
      }
      continue;
    }

    const updated = await finishClaim(claim, { status: 'resolved', action: claim.timeoutAction, guidance: `Automatically ${claim.timeoutAction}d after timeout`, resolvedBy: 'system', resolvedAt: now, timeoutClaimId: null, timeoutClaimedAt: null });
    if (updated) {
      if (claim.timeoutAction === 'continue') result.continued++; else result.aborted++;
      await deliverConfessionCallback(updated, 'confession.timed_out');
    }
  }
  return result;
}
