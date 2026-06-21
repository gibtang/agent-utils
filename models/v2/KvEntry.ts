/**
 * AgentUtils v2 — KV entry (PRD §8).
 *
 * Composite uniqueness on (tenantId, namespace, key). `version` starts at 1 and
 * increments on every write. CAS is enforced in the route via atomic
 * findOneAndUpdate with a version conditional.
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IKvEntry extends Document {
  tenantId: string;
  namespace: string; // agent_id or "shared"
  key: string;
  value: unknown; // JSON
  ttlSeconds: number | null;
  expiresAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const KvEntrySchema = new Schema<IKvEntry>(
  {
    tenantId: { type: String, required: true },
    namespace: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    ttlSeconds: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

KvEntrySchema.index({ tenantId: 1, namespace: 1, key: 1 }, { unique: true });
KvEntrySchema.index({ tenantId: 1, namespace: 1 });
KvEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // R-KV-9 lazy purge

export default (mongoose.models.KvEntryV2 as mongoose.Model<IKvEntry>) ||
  mongoose.model<IKvEntry>('KvEntryV2', KvEntrySchema);
