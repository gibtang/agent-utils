/**
 * AgentUtils v2 — DLQ item (PRD §10).
 *
 * Independent of Scheduler. Atomic claim/release/fail/resolve via conditional
 * findOneAndUpdate on (status, locked_until). Per-agent in MVP.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type DlqStatus = 'failed' | 'claimed' | 'resolved' | 'archived';

export interface IDlqItem extends Document {
  dlqId: string; // dlq_xxx
  tenantId: string;
  agentId: string;
  workflowId: string | null;
  operation: string;
  source: string;
  sourceId: string | null;
  payload: unknown;
  errorType: string | null;
  errorMessage: string;
  errorCode: string | null;
  lastError: unknown; // { type, message, code } from latest release/fail
  failedAt: Date; // last time status became failed
  lastAttemptedAt: Date | null;
  nextRetryAfter: Date | null;
  status: DlqStatus;
  attemptCount: number;
  maxAttempts: number;
  lockedBy: string | null;
  lockedUntil: Date | null;
  label: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  result: unknown;
  archivedAt: Date | null;
  expiresAt: Date; // retention purge (30 days)
  createdAt: Date;
  updatedAt: Date;
}

const DlqSchema = new Schema<IDlqItem>(
  {
    dlqId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    workflowId: { type: String, default: null },
    operation: { type: String, required: true },
    source: { type: String, required: true },
    sourceId: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: null },
    errorType: { type: String, default: null },
    errorMessage: { type: String, required: true },
    errorCode: { type: String, default: null },
    lastError: { type: Schema.Types.Mixed, default: null },
    failedAt: { type: Date, required: true },
    lastAttemptedAt: { type: Date, default: null },
    nextRetryAfter: { type: Date, default: null },
    status: { type: String, enum: ['failed', 'claimed', 'resolved', 'archived'], required: true, index: true },
    attemptCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lockedBy: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
    label: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    archivedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

DlqSchema.index({ tenantId: 1, agentId: 1, status: 1 });
DlqSchema.index({ tenantId: 1, workflowId: 1 });
DlqSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.DlqItemV2 as mongoose.Model<IDlqItem>) ||
  mongoose.model<IDlqItem>('DlqItemV2', DlqSchema);
