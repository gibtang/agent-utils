/**
 * AgentUtils v2 — Confession resolution + notification engines.
 *
 * Mirrors lib/v2/hitl.ts structure:
 *   - applyConfessionResolution(): approve/reject/expire → signed callback + DLQ cascade
 *   - processConfessionNotifications(): tick sweep — send due emails idempotently
 *   - processConfessionEscalations(): tick sweep — escalate unanswered confessions
 *   - processConfessionExpiries(): tick sweep — auto-expire past expiresAt
 *   - enqueueNotification(): create a NotificationJob (called at confession create + escalate)
 *   - cancelPendingNotifications(): terminal-state sweep (resolve/cancel/expire)
 *
 * Audit trail: every state transition writes an AuditLog entry with a stable
 * dot-namespaced action (confession.created, confession.email_sent, etc.).
 */
import Confession, { type ConfessionDecision, type ConfessionUrgency } from '@/models/v2/Confession';
import NotificationJob from '@/models/v2/NotificationJob';
import Tenant from '@/models/v2/Tenant';
import AuditLog from '@/models/v2/AuditLog';
import DlqItem from '@/models/v2/DlqItem';
import { deliverCallback } from './callbackSecurity';
import { renderConfessionEmailHtml, sendRawEmail } from './email';
import { issueConfessionToken } from './confessionTokens';
import { resourceId } from './ids';
import { quotaFor } from './quota';

const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 86400_000;
const DEFAULT_ESCALATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/** App URL root for building the reviewer deep link. */
export function publicAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.agent-utils.com').replace(/\/$/, '');
}

export function buildReviewUrl(confessionId: string, tokenPlaintext: string): string {
  return `${publicAppUrl()}/c/${confessionId}?t=${tokenPlaintext}`;
}

/** Public audit writer for routes to use (create/cancel/etc). */
export async function writeAuditEntry(args: {
  tenantId: string;
  agentId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  payload?: unknown;
  plan: string;
  now?: Date;
  requestId?: string;
}): Promise<void> {
  return writeAudit(args);
}

async function writeAudit(args: {
  tenantId: string;
  agentId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  payload?: unknown;
  plan: string;
  now?: Date;
  requestId?: string;
}): Promise<void> {
  const now = args.now ?? new Date();
  await AuditLog.create({
    auditId: resourceId('log_'),
    tenantId: args.tenantId,
    agentId: args.agentId,
    action: args.action,
    resourceType: args.resourceType ?? 'confession',
    resourceId: args.resourceId ?? null,
    payload: args.payload ?? null,
    metadata: null,
    timestamp: now,
    requestId: args.requestId ?? null,
    expiresAt: new Date(now.getTime() + quotaFor(args.plan).auditRetentionDays * 86400_000),
  });
}

// ── enqueue / cancel notifications ──────────────────────────────────────────

/**
 * Structural shape of a Confession used by the notification/escalation engines.
 * Accepts both a Mongoose `IConfession` document and a `.lean()` plain object,
 * so callers don't have to coerce. Keep this in sync with the Confession schema.
 */
export interface ConfessionSnapshot {
  confessionId: string;
  tenantId: string;
  agentId: string;
  title: string;
  summary: string | null;
  urgency: ConfessionUrgency;
  status: string;
  expiresAt: Date;
  expiresAtPurge: Date;
  callbackUrl: string;
  callbackPayload: unknown;
  reviewerEmail?: string | null;
}

/**
 * Enqueue an email notification job. Renders the email body immediately so
 * retries use a stable snapshot. The job is created with status=pending and
 * sendAt=now; the tick sweep performs the actual send.
 *
 * Returns the created job (or null if the recipient is empty).
 */
export async function enqueueNotification(args: {
  confession: ConfessionSnapshot;
  recipient: string;
  escalationTier: number;
  origin: string;
  plan: string;
  reviewUrl: string; // already-built view-scope URL with embedded token
  now?: Date;
}): Promise<{ jobId: string } | null> {
  const now = args.now ?? new Date();
  if (!args.recipient) return null;
  const subject =
    args.escalationTier > 0 ? `[Escalated] Review requested: ${args.confession.title}` : `Review requested: ${args.confession.title}`;
  // Render a stable HTML snapshot now so retries send byte-identical content.
  const html = renderConfessionEmailHtml({
    to: args.recipient,
    confessionId: args.confession.confessionId,
    title: args.confession.title,
    summary: args.confession.summary,
    agentId: args.confession.agentId,
    urgency: args.confession.urgency as ConfessionUrgency,
    expiresAt: args.confession.expiresAt,
    reviewUrl: args.reviewUrl,
    escalationTier: args.escalationTier,
  });

  const job = await NotificationJob.create({
    jobId: resourceId('nj_'),
    tenantId: args.confession.tenantId,
    confessionId: args.confession.confessionId,
    channel: 'email',
    recipient: args.recipient,
    escalationTier: args.escalationTier,
    subject,
    bodyHtml: html,
    status: 'pending',
    attemptCount: 0,
    maxAttempts: MAX_ATTEMPTS,
    sendAt: now,
    lastError: null,
    sentAt: null,
    origin: args.origin,
    expiresAtPurge: args.confession.expiresAtPurge,
  });
  return { jobId: job.jobId };
}

/** Atomically cancel all pending jobs for a confession (terminal-state sweep). */
export async function cancelPendingNotifications(confessionId: string): Promise<number> {
  const r = await NotificationJob.updateMany(
    { confessionId, status: 'pending' },
    { $set: { status: 'cancelled' } },
  );
  return r.modifiedCount;
}

// ── resolution ──────────────────────────────────────────────────────────────

export interface ConfessionResolutionInput {
  decision: 'approved' | 'rejected' | 'expired';
  by: string; // 'reviewer' | 'system' | agent id | tenant admin
  note?: string | null;
}

/**
 * Apply a resolution to a confession, cancel pending notifications, fire the
 * signed `confession.resolved` callback, and cascade to DLQ on delivery
 * failure. Returns the delivery outcome.
 */
export async function applyConfessionResolution(
  confessionId: string,
  tenantId: string,
  input: ConfessionResolutionInput,
  opts: { now?: Date; requestId?: string } = {},
): Promise<{ updated: boolean; delivered: boolean; dlqCreated: boolean }> {
  const now = opts.now ?? new Date();
  const updated = await Confession.findOneAndUpdate(
    { confessionId, tenantId, status: 'pending' },
    {
      $set: {
        status: input.decision === 'approved' ? 'resolved' : input.decision === 'rejected' ? 'resolved' : 'expired',
        resolutionDecision: input.decision as ConfessionDecision,
        resolutionBy: input.by,
        resolutionNote: input.note ?? null,
        resolvedAt: now,
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) return { updated: false, delivered: false, dlqCreated: false };

  // Cancel any pending notification work — terminal state.
  await cancelPendingNotifications(confessionId);

  // Release pending-confession quota.
  await Tenant.updateOne({ tenantId }, { $inc: { pendingConfessionCount: -1 } });

  const tenant = (await Tenant.findOne({ tenantId }).lean()) as { callbackSecret?: string; plan?: string } | null;
  const secret = tenant?.callbackSecret ?? '';
  const plan = tenant?.plan ?? 'free';
  const deliveryId = resourceId('del_');

  await writeAudit({
    tenantId,
    agentId: updated.agentId,
    action: `confession.${input.decision}`,
    resourceId: confessionId,
    payload: { decision: input.decision, by: input.by, note: input.note ?? null },
    plan,
    now,
    requestId: opts.requestId,
  });

  const body = {
    event: 'confession.resolved',
    confession_id: updated.confessionId,
    agent_id: updated.agentId,
    decision: input.decision,
    resolved_by: input.by,
    note: input.note ?? null,
    resolved_at: now.toISOString(),
    original_payload: updated.callbackPayload,
  };

  const res = await deliverCallback(updated.callbackUrl, secret, 'confession.resolved', body, deliveryId, {
    'X-AgentUtils-Confession-Id': updated.confessionId,
  });

  if (res.ok) {
    await Confession.updateOne({ confessionId }, { $set: { callbackDelivered: true } });
    return { updated: true, delivered: true, dlqCreated: false };
  }

  // Callback delivery failed → DLQ entry (mirrors HitL).
  await DlqItem.create({
    dlqId: resourceId('dlq_'),
    tenantId,
    agentId: updated.agentId,
    workflowId: null,
    operation: 'confession.callback',
    source: 'confession',
    sourceId: updated.confessionId,
    payload: { decision: input.decision, by: input.by, note: input.note ?? null, callback_payload: updated.callbackPayload, callback_url: updated.callbackUrl },
    errorType: `HTTP_${res.status || 0}`,
    errorMessage: `Confession resolution callback delivery failed: ${res.statusText}`,
    errorCode: 'CALLBACK_DELIVERY_FAILED',
    failedAt: now,
    status: 'failed',
    attemptCount: 0,
    maxAttempts: 5,
    expiresAt: new Date(now.getTime() + RETENTION_MS),
  });
  await Tenant.updateOne({ tenantId }, { $inc: { dlqItemCount: 1 } });
  return { updated: true, delivered: false, dlqCreated: true };
}

// ── tick engines ────────────────────────────────────────────────────────────

/**
 * Notification tick: find due pending jobs, atomically claim each via
 * `pending → sending`, and send via Resend. Only the winner of the conditional
 * update sends — tick retries are idempotent and never duplicate.
 */
export async function processConfessionNotifications(opts: { now?: Date; limit?: number } = {}): Promise<{
  attempted: number;
  sent: number;
  failed: number;
}> {
  const now = opts.now ?? new Date();
  const out = { attempted: 0, sent: 0, failed: 0 };

  // Pull a batch of due pending jobs.
  const due = await NotificationJob.find({ status: 'pending', sendAt: { $lte: now } })
    .limit(opts.limit ?? 50)
    .lean();
  for (const job of due) {
    // Atomic claim: only one tick wins.
    const claimed = await NotificationJob.findOneAndUpdate(
      { _id: job._id, status: 'pending' },
      { $set: { status: 'sending' }, $inc: { attemptCount: 1 } },
      { returnDocument: 'after' },
    ).lean();
    if (!claimed) continue; // someone else won
    out.attempted++;

    // Skip if the underlying confession is no longer pending (race safety).
    const confession = await Confession.findOne({ confessionId: claimed.confessionId }).lean();
    if (!confession || confession.status !== 'pending') {
      await NotificationJob.updateOne({ _id: claimed._id }, { $set: { status: 'cancelled' } });
      continue;
    }

    const tenant = (await Tenant.findOne({ tenantId: claimed.tenantId }).lean()) as { plan?: string } | null;
    const plan = tenant?.plan ?? 'free';

    // Send the stable HTML snapshot stored at enqueue time. Retries therefore
    // send byte-identical content, including the original embedded reviewer
    // token — no re-render, no token drift.
    const result = await sendRawEmail({
      to: claimed.recipient,
      subject: claimed.subject,
      html: claimed.bodyHtml ?? '',
    });

    if (result.ok) {
      await NotificationJob.updateOne({ _id: claimed._id }, { $set: { status: 'sent', sentAt: new Date(), lastError: null } });
      out.sent++;
      await writeAudit({
        tenantId: claimed.tenantId,
        agentId: confession.agentId,
        action: claimed.escalationTier > 0 ? 'confession.email_escalated_sent' : 'confession.email_sent',
        resourceId: claimed.confessionId,
        payload: { recipient: claimed.recipient, job_id: claimed.jobId, message_id: result.messageId ?? null },
        plan,
        now,
      });
    } else {
      // Retry if attempts remain, else fail.
      if (claimed.attemptCount >= claimed.maxAttempts) {
        await NotificationJob.updateOne(
          { _id: claimed._id },
          { $set: { status: 'failed', lastError: result.error ?? 'UNKNOWN' } },
        );
        out.failed++;
      } else {
        await NotificationJob.updateOne(
          { _id: claimed._id },
          {
            $set: {
              status: 'pending',
              lastError: result.error ?? 'UNKNOWN',
              sendAt: new Date(now.getTime() + backoffMs(claimed.attemptCount)),
            },
          },
        );
      }
      await writeAudit({
        tenantId: claimed.tenantId,
        agentId: confession.agentId,
        action: 'confession.email_failed',
        resourceId: claimed.confessionId,
        payload: { recipient: claimed.recipient, job_id: claimed.jobId, error: result.error ?? 'UNKNOWN', attempt: claimed.attemptCount },
        plan,
        now,
      });
    }
  }
  return out;
}

function backoffMs(attempt: number): number {
  // 30s, 90s, 270s, 810s … capped.
  return Math.min(30_000 * Math.pow(3, Math.max(0, attempt - 1)), 15 * 60 * 1000);
}

/**
 * Escalation tick: for confessions still pending past the escalation window
 * (default 15min) that have NOT yet been escalated, enqueue a tier-1 job to the
 * reviewer (currently the same tenant ownerEmail) and mark escalatedAt so the
 * sweep never duplicates.
 */
export async function processConfessionEscalations(opts: { now?: Date; limit?: number } = {}): Promise<{ escalated: number }> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - DEFAULT_ESCALATION_MS);
  const out = { escalated: 0 };

  const due = (await Confession.find({ status: 'pending', escalatedAt: null, createdAt: { $lte: cutoff } })
    .limit(opts.limit ?? 50)
    .lean()) as unknown as ConfessionSnapshot[];
  for (const c of due) {
    // Atomic claim via escalatedAt set-if-null.
    const claimed = await Confession.findOneAndUpdate(
      { confessionId: c.confessionId, escalatedAt: null },
      { $set: { escalatedAt: now } },
      { returnDocument: 'after' },
    ).lean();
    if (!claimed) continue;

    const tenant = (await Tenant.findOne({ tenantId: c.tenantId }).lean()) as { ownerEmail?: string; plan?: string } | null;
    const recipient = c.reviewerEmail ?? tenant?.ownerEmail ?? '';
    if (!recipient) continue;

    // Issue a fresh view token for the escalation email.
    const issued = await issueConfessionToken({ confessionId: c.confessionId, tenantId: c.tenantId, scope: 'view', now });
    const reviewUrl = buildReviewUrl(c.confessionId, issued.plaintext);

    await enqueueNotification({
      confession: c,
      recipient,
      escalationTier: 1,
      origin: 'escalated',
      plan: tenant?.plan ?? 'free',
      reviewUrl,
      now,
    });
    out.escalated++;
    await writeAudit({
      tenantId: c.tenantId,
      agentId: c.agentId,
      action: 'confession.escalated',
      resourceId: c.confessionId,
      payload: { recipient, tier: 1 },
      plan: tenant?.plan ?? 'free',
      now,
    });
  }
  return out;
}

/**
 * Expiry tick: confessions still pending past their expiresAt move to expired
 * status. The default timeout fallback mirrors the HitL `auto_reject` semantic
 * (decision: 'expired', by: 'system').
 */
export async function processConfessionExpiries(opts: { now?: Date; limit?: number } = {}): Promise<{ expired: number }> {
  const now = opts.now ?? new Date();
  const out = { expired: 0 };
  const due = (await Confession.find({ status: 'pending', expiresAt: { $lte: now } })
    .limit(opts.limit ?? 50)
    .lean()) as unknown as ConfessionSnapshot[];
  for (const c of due) {
    const r = await applyConfessionResolution(c.confessionId, c.tenantId, {
      decision: 'expired',
      by: 'system',
      note: 'Auto-expired due to timeout',
    }, { now });
    if (r.updated) out.expired++;
  }
  return out;
}
