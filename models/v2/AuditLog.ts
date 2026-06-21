/**
 * AgentUtils v2 — Audit Log entry (PRD §11).
 *
 * Append-only. No PATCH/DELETE route exists. timestamp is server-assigned.
 * TTL index purges entries after the tenant plan retention window — set per-doc.
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  auditId: string; // log_xxx — stable across reads
  tenantId: string;
  agentId: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  payload: unknown;
  metadata: unknown;
  timestamp: Date;
  requestId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    agentId: { type: String, required: true },
    action: { type: String, required: true },
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    timestamp: { type: Date, required: true, index: true },
    requestId: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, 'metadata.workflow_id': 1 });
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.AuditLogV2 as mongoose.Model<IAuditLog>) ||
  mongoose.model<IAuditLog>('AuditLogV2', AuditLogSchema);
