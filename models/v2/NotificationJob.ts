/**
 * AgentUtils v2 — NotificationJob model.
 *
 * An idempotent, retry-safe unit of email delivery work for Confessions. The
 * tick engine (`processConfessionNotifications`) sweeps due jobs and delivers
 * them via Resend; only the atomic winner of `status: pending → sending` sends,
 * so tick retries never duplicate sends.
 *
 * Escalation: tier 0 is the immediate creation email; tier 1 is enqueued by the
 * escalation sweep (after the tenant's configured delay, default 15min) when a
 * confession is still pending. Terminal-state sweeps cancel any pending jobs.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type NotificationChannel = 'email';
export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface INotificationJob extends Document {
  jobId: string; // nj_xxx
  tenantId: string;
  confessionId: string;
  channel: NotificationChannel;
  recipient: string; // email address
  escalationTier: number; // 0 = immediate, 1 = escalation
  subject: string;
  bodyHtml: string | null; // rendered template snapshot (so retries are stable)
  status: NotificationStatus;
  attemptCount: number;
  maxAttempts: number;
  sendAt: Date; // when the tick may pick this up
  lastError: string | null;
  sentAt: Date | null;
  // Audit trail: who/what caused this job (created | escalated).
  origin: string;
  expiresAtPurge: Date; // retention purge aligned with the confession
  createdAt: Date;
  updatedAt: Date;
}

const NotificationJobSchema = new Schema<INotificationJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    confessionId: { type: String, required: true, index: true },
    channel: { type: String, enum: ['email'], required: true, default: 'email' },
    recipient: { type: String, required: true },
    escalationTier: { type: Number, required: true, default: 0, min: 0 },
    subject: { type: String, required: true },
    bodyHtml: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed', 'cancelled'],
      required: true,
      default: 'pending',
      index: true,
    },
    attemptCount: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    sendAt: { type: Date, required: true },
    lastError: { type: String, default: null },
    sentAt: { type: Date, default: null },
    origin: { type: String, required: true, default: 'created' },
    expiresAtPurge: { type: Date, required: true },
  },
  { timestamps: true },
);

// Tick sweep: find due pending jobs in order.
NotificationJobSchema.index({ status: 1, sendAt: 1 });
// Per-confession lookup (terminal-state cancellation).
NotificationJobSchema.index({ confessionId: 1, status: 1 });
// Retention purge.
NotificationJobSchema.index({ expiresAtPurge: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.NotificationJobV2 as mongoose.Model<INotificationJob>) ||
  mongoose.model<INotificationJob>('NotificationJobV2', NotificationJobSchema);
