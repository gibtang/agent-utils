/**
 * AgentUtils v2 — HitL resolution engine (PRD §12).
 *
 * resolveCheckpoint() handles approve/reject/timeout, fires the signed callback,
 * and on delivery failure creates a DLQ item (source=checkpoint). The checkpoint
 * status itself is not rolled back — DLQ handles delivery independently.
 */
import Checkpoint, { CheckpointStatus } from '@/models/v2/Checkpoint';
import DlqItem from '@/models/v2/DlqItem';
import Tenant from '@/models/v2/Tenant';
import { deliverCallback } from './callbackSecurity';
import { resourceId } from './ids';

const RETENTION_DAYS = 30;

export interface ResolutionInput {
  decision: 'approved' | 'rejected' | 'expired';
  by: string;
  note?: string | null;
}

/**
 * Apply a resolution to a checkpoint, fire the callback, and cascade to DLQ
 * on delivery failure. Returns the updated checkpoint.
 */
export async function applyResolution(
  checkpointId: string,
  tenantId: string,
  input: ResolutionInput,
  opts: { now?: Date } = {},
): Promise<{ delivered: boolean; dlqCreated: boolean }> {
  const now = opts.now ?? new Date();
  const cp = await Checkpoint.findOneAndUpdate(
    { checkpointId, tenantId, status: 'pending' },
    {
      $set: {
        status: input.decision === 'approved' ? 'approved' : input.decision === 'rejected' ? 'rejected' : 'expired',
        resolutionDecision: input.decision,
        resolutionBy: input.by,
        resolutionNote: input.note ?? null,
        resolvedAt: now,
      },
    },
    { new: true },
  ).lean();
  if (!cp) return { delivered: false, dlqCreated: false };

  const tenant = await Tenant.findOne({ tenantId }).lean();
  const secret = (tenant as { callbackSecret?: string } | null)?.callbackSecret ?? '';
  const deliveryId = resourceId('del_');

  const body = {
    event: 'checkpoint.resolved',
    checkpoint_id: cp.checkpointId,
    agent_id: cp.agentId,
    decision: input.decision,
    resolved_by: input.by,
    note: input.note ?? null,
    resolved_at: now.toISOString(),
    original_payload: cp.callbackPayload,
  };

  const res = await deliverCallback(cp.callbackUrl, secret, 'checkpoint.resolved', body, deliveryId, {
    'X-AgentUtils-Checkpoint-Id': cp.checkpointId,
  });

  if (res.ok) {
    await Checkpoint.updateOne({ checkpointId }, { $set: { callbackDelivered: true } });
    return { delivered: true, dlqCreated: false };
  }

  // Callback delivery failed → DLQ entry (R-DLQ-7).
  await DlqItem.create({
    dlqId: resourceId('dlq_'),
    tenantId,
    agentId: cp.agentId,
    workflowId: null,
    operation: 'checkpoint.callback',
    source: 'checkpoint',
    sourceId: cp.checkpointId,
    payload: { decision: input.decision, by: input.by, note: input.note ?? null, callback_payload: cp.callbackPayload, callback_url: cp.callbackUrl },
    errorType: `HTTP_${res.status || 0}`,
    errorMessage: `Checkpoint resolution callback delivery failed: ${res.statusText}`,
    errorCode: 'CALLBACK_DELIVERY_FAILED',
    failedAt: now,
    status: 'failed',
    attemptCount: 0,
    maxAttempts: 5,
    expiresAt: new Date(now.getTime() + RETENTION_DAYS * 86400_000),
  });
  await Tenant.updateOne({ tenantId }, { $inc: { dlqItemCount: 1 } });
  return { delivered: false, dlqCreated: true };
}

/**
 * Timeout processor: find pending checkpoints past their expiresAt and apply
 * their timeout_action.
 */
export async function processTimeouts(opts: { now?: Date; limit?: number } = {}): Promise<{ autoRejected: number; dlqExpired: number }> {
  const now = opts.now ?? new Date();
  const result = { autoRejected: 0, dlqExpired: 0 };
  const due = await Checkpoint.find({ status: 'pending', expiresAt: { $lte: now } })
    .limit(opts.limit ?? 100)
    .lean();
  for (const cp of due) {
    if (cp.timeoutAction === 'auto_reject') {
      const r = await applyResolution(cp.checkpointId, cp.tenantId, { decision: 'expired', by: 'system', note: 'Auto-rejected due to timeout' }, { now });
      if (r.delivered || r.dlqCreated) result.autoRejected++;
    } else {
      // timeout_action=dlq: move to expired status and create DLQ with full context
      await Checkpoint.updateOne(
        { checkpointId: cp.checkpointId, status: 'pending' },
        { $set: { status: 'expired', resolutionDecision: 'expired', resolvedAt: now } },
      );
      await DlqItem.create({
        dlqId: resourceId('dlq_'),
        tenantId: cp.tenantId,
        agentId: cp.agentId,
        workflowId: null,
        operation: 'checkpoint.timeout',
        source: 'checkpoint',
        sourceId: cp.checkpointId,
        payload: { checkpoint_context: cp.context, callback_payload: cp.callbackPayload, title: cp.title },
        errorType: 'TIMEOUT',
        errorMessage: 'Checkpoint expired and timeout_action=dlq',
        errorCode: 'CHECKPOINT_TIMEOUT',
        failedAt: now,
        status: 'failed',
        attemptCount: 0,
        maxAttempts: 5,
        expiresAt: new Date(now.getTime() + RETENTION_DAYS * 86400_000),
      });
      await Tenant.updateOne({ tenantId: cp.tenantId }, { $inc: { dlqItemCount: 1 } });
      result.dlqExpired++;
    }
  }
  return result;
}
