import mongoose, { type InferSchemaType } from 'mongoose';
import { resourceId } from '@/lib/core/ids';

const ConnectionSchema = new mongoose.Schema({
  connectionId: { type: String, required: true, unique: true, default: () => resourceId('conn_') },
  accountId: { type: String, required: true, index: true },
  agentId: { type: String, required: true, index: true },
  credentialHash: { type: String, required: true, unique: true },
  displayPrefix: { type: String, required: true },
  runtime: { type: String, default: null },
  status: { type: String, enum: ['active', 'needs_attention', 'suspended', 'revoked'], default: 'active' },
  suspensionReason: { type: String, default: null },
  lastActivityAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

export type ConnectionDocument = InferSchemaType<typeof ConnectionSchema>;
export default (mongoose.models.Connection as mongoose.Model<ConnectionDocument> | undefined) ?? mongoose.model<ConnectionDocument>('Connection', ConnectionSchema);
