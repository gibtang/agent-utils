import mongoose, { Schema, Document } from 'mongoose';

export type ConfessionStatus = 'open' | 'timeout_processing' | 'resolved' | 'expired';
export type ConfessionUrgency = 'low' | 'medium' | 'high' | 'blocking';
export type ConfessionTimeoutAction = 'continue' | 'abort' | 'escalate_to_dlq';
export type ConfessionAction = 'continue' | 'pivot' | 'abort';

export interface IConfession extends Document {
  confessionId: string; tenantId: string; agentId: string; summary: string; concerns: string[];
  confidence: number; context: unknown; urgency: ConfessionUrgency; status: ConfessionStatus; blocking: boolean;
  expiresAt: Date; timeoutAction: ConfessionTimeoutAction; guidance: string | null; action: ConfessionAction | null;
  resolvedBy: string | null; resolvedAt: Date | null; callbackUrl: string | null; expiresAtPurge: Date;
  timeoutClaimId: string | null; timeoutClaimedAt: Date | null;
  callbackAttempts: number; callbackDeliveredAt: Date | null; callbackLastError: string | null;
  createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IConfession>({
  confessionId: { type: String, required: true, unique: true, index: true }, tenantId: { type: String, required: true, index: true }, agentId: { type: String, required: true, index: true },
  summary: { type: String, required: true }, concerns: { type: [String], required: true }, confidence: { type: Number, required: true, min: 0, max: 1 }, context: { type: Schema.Types.Mixed, default: null },
  urgency: { type: String, enum: ['low', 'medium', 'high', 'blocking'], required: true }, status: { type: String, enum: ['open', 'timeout_processing', 'resolved', 'expired'], required: true, index: true }, blocking: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }, timeoutAction: { type: String, enum: ['continue', 'abort', 'escalate_to_dlq'], required: true }, guidance: { type: String, default: null }, action: { type: String, enum: ['continue', 'pivot', 'abort'], default: null },
  resolvedBy: { type: String, default: null }, resolvedAt: { type: Date, default: null }, callbackUrl: { type: String, default: null }, expiresAtPurge: { type: Date, required: true },
  timeoutClaimId: { type: String, default: null }, timeoutClaimedAt: { type: Date, default: null },
  callbackAttempts: { type: Number, default: 0 }, callbackDeliveredAt: { type: Date, default: null }, callbackLastError: { type: String, default: null },
}, { timestamps: true });
schema.index({ tenantId: 1, status: 1, _id: -1 });
schema.index({ status: 1, expiresAt: 1 });
schema.index({ expiresAtPurge: 1 }, { expireAfterSeconds: 0 });
export default (mongoose.models.ConfessionV2 as mongoose.Model<IConfession>) || mongoose.model<IConfession>('ConfessionV2', schema);
