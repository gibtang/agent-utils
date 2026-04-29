import mongoose, { Schema, Document } from 'mongoose';

export type AuditSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  agentName: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  severity: AuditSeverity;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  agentName: { type: String, default: 'unknown' },
  action: { type: String, required: true },
  target: { type: String },
  metadata: { type: Schema.Types.Mixed },
  severity: { type: String, enum: ['info', 'warn', 'error', 'critical'], default: 'info', index: true },
}, { timestamps: true });

// Compound indexes for common query patterns
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, agentName: 1 });
AuditLogSchema.index({ userId: 1, severity: 1 });

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
