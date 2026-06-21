/**
 * AgentUtils v2 — HitL Checkpoint (PRD §12).
 *
 * Agent keys may create/list/read/poll/cancel their own checkpoints.
 * Approve/reject requires tenant admin key OR a scoped approval-proxy key.
 * Callback delivery failures cascade to DLQ (source=checkpoint).
 */
import mongoose, { Schema, Document } from 'mongoose';

export type CheckpointStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type TimeoutAction = 'auto_reject' | 'dlq';

export interface ICheckpoint extends Document {
  checkpointId: string; // hitl_xxx
  tenantId: string;
  agentId: string;
  title: string;
  description: string | null;
  context: unknown;
  status: CheckpointStatus;
  expiresAt: Date;
  timeoutAction: TimeoutAction;
  callbackUrl: string;
  callbackPayload: unknown;
  resolutionDecision: 'approved' | 'rejected' | 'expired' | null;
  resolutionBy: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  callbackDelivered: boolean;
  expiresAtPurge: Date; // retention
  createdAt: Date;
  updatedAt: Date;
}

const CheckpointSchema = new Schema<ICheckpoint>(
  {
    checkpointId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    context: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled'], required: true, index: true },
    expiresAt: { type: Date, required: true },
    timeoutAction: { type: String, enum: ['auto_reject', 'dlq'], default: 'auto_reject' },
    callbackUrl: { type: String, required: true },
    callbackPayload: { type: Schema.Types.Mixed, default: null },
    resolutionDecision: { type: String, enum: ['approved', 'rejected', 'expired'], default: null },
    resolutionBy: { type: String, default: null },
    resolutionNote: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    callbackDelivered: { type: Boolean, default: false },
    expiresAtPurge: { type: Date, required: true },
  },
  { timestamps: true },
);

CheckpointSchema.index({ tenantId: 1, status: 1 });
CheckpointSchema.index({ status: 1, expiresAt: 1 });
CheckpointSchema.index({ expiresAtPurge: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.CheckpointV2 as mongoose.Model<ICheckpoint>) ||
  mongoose.model<ICheckpoint>('CheckpointV2', CheckpointSchema);
