import mongoose, { Schema, Document } from 'mongoose';

export type CheckpointStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ICheckpoint extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  agentName: string;
  taskDescription: string;
  state: Record<string, unknown>; // Serialized agent state
  status: CheckpointStatus;
  webhookUrl?: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const CheckpointSchema = new Schema<ICheckpoint>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  agentName: { type: String, default: 'unknown' },
  taskDescription: { type: String, required: true },
  state: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending', index: true },
  webhookUrl: { type: String },
  reviewedBy: { type: String },
  reviewNote: { type: String },
  reviewedAt: { type: Date },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

export default mongoose.models.Checkpoint || mongoose.model<ICheckpoint>('Checkpoint', CheckpointSchema);
