import mongoose, { type InferSchemaType } from 'mongoose';
import { resourceId } from '@/lib/core/ids';

const AgentSchema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true, default: () => resourceId('agt_') },
  accountId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
}, { timestamps: true, versionKey: false });
AgentSchema.index({ accountId: 1, name: 1 }, { unique: true });

export type AgentDocument = InferSchemaType<typeof AgentSchema>;
export default (mongoose.models.Agent as mongoose.Model<AgentDocument> | undefined) ?? mongoose.model<AgentDocument>('Agent', AgentSchema);
