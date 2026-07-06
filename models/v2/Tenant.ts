/**
 * AgentUtils v2 — Tenant model.
 *
 * Owns per-tenant resource counters used for atomic quota enforcement (R-QUOTA-2).
 * All counters are mutated with atomic conditional findOneAndUpdate so concurrent
 * creation requests cannot overshoot a limit.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type TenantStatus = 'active' | 'suspended' | 'pending_deletion' | 'deleted';
export type TenantPlan = 'free' | 'pro';

export interface ITenant extends Document {
  tenantId: string; // ten_xxx
  name: string;
  ownerEmail: string;
  ownerUid?: string | null; // Firebase UID of the owning user (hidden user-account tenants)
  plan: TenantPlan;
  status: TenantStatus;
  adminKey: string; // plaintext admin key
  callbackSecret: string; // HMAC secret for signed callbacks
  // quota counters (atomic)
  agentCount: number;
  kvKeyCount: number;
  kvStorageBytes: number;
  activeScheduleCount: number;
  pendingCheckpointCount: number;
  dlqItemCount: number;
  lastActivityAt: Date;
  // rate-limit minute bucket counter
  rlBucket?: string;
  rlCount?: number;
  suspendedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, index: true },
    ownerEmail: { type: String, required: true },
    ownerUid: { type: String, default: null, index: true },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    status: { type: String, enum: ['active', 'suspended', 'pending_deletion', 'deleted'], default: 'active', index: true },
    adminKey: { type: String, required: true },
    callbackSecret: { type: String, required: true },
    agentCount: { type: Number, default: 0 },
    kvKeyCount: { type: Number, default: 0 },
    kvStorageBytes: { type: Number, default: 0 },
    activeScheduleCount: { type: Number, default: 0 },
    pendingCheckpointCount: { type: Number, default: 0 },
    dlqItemCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: () => new Date() },
    rlBucket: { type: String, default: null },
    rlCount: { type: Number, default: 0 },
    suspendedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

TenantSchema.index({ status: 1, lastActivityAt: 1 });

export default (mongoose.models.TenantV2 as mongoose.Model<ITenant>) ||
  mongoose.model<ITenant>('TenantV2', TenantSchema);
