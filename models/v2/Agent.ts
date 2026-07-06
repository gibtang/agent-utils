/**
 * AgentUtils v2 — Agent model.
 *
 * Agent names are unique within a tenant (compound index). The same name can
 * exist in different tenants (ME-MT-1). `shared` is reserved and may never be
 * used as an agent name (R-KV-8).
 */
import mongoose, { Schema, Document } from 'mongoose';

export const RESERVED_AGENT_NAMES = new Set(['shared']);

export interface IAgent extends Document {
  agentId: string; // agent name — used as X-Agent-Id and KV namespace
  tenantId: string; // ten_xxx
  description?: string;
  callbackBaseUrl?: string;
  apiKey: string; // plaintext agent key
  description2?: string; // unused, retained to avoid collision
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    agentId: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    description: { type: String, maxlength: 256 },
    callbackBaseUrl: { type: String },
    apiKey: { type: String, required: true },
  },
  { timestamps: true },
);

AgentSchema.index({ tenantId: 1, agentId: 1 }, { unique: true });

export default (mongoose.models.AgentV2 as mongoose.Model<IAgent>) ||
  mongoose.model<IAgent>('AgentV2', AgentSchema);
