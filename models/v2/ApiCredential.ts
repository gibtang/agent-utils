/**
 * AgentUtils v2 — ApiKey lookup index.
 *
 * Keys are stored hashed in Tenant (admin) and Agent (agent). This collection is
 * a fast hash -> {tenantId, agentId, keyType} resolver for the auth layer. It is
 * the single source of truth for credential resolution (PRD §5.1).
 */
import mongoose, { Schema, Document } from 'mongoose';

export type KeyType = 'admin' | 'agent' | 'approval-proxy';

export interface IApiCredential extends Document {
  keyHash: string; // sha256 hex
  keyPrefix: string; // agutil_adm_ / agutil_agt_
  keyType: KeyType;
  tenantId: string; // ten_xxx
  agentId?: string | null; // null for admin keys
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApiCredentialSchema = new Schema<IApiCredential>(
  {
    keyHash: { type: String, required: true, unique: true, index: true },
    keyPrefix: { type: String, required: true },
    keyType: { type: String, enum: ['admin', 'agent', 'approval-proxy'], required: true },
    tenantId: { type: String, required: true, index: true },
    agentId: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default (mongoose.models.ApiCredentialV2 as mongoose.Model<IApiCredential>) ||
  mongoose.model<IApiCredential>('ApiCredentialV2', ApiCredentialSchema);
