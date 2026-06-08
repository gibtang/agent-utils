import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type CheckpointStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ICheckpoint extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  agentName: string;
  taskDescription: string;
  state: Record<string, unknown>; // Serialized agent state
  status: CheckpointStatus;
  publicToken: string; // For public approval page (no auth required)
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
  publicToken: { type: String, required: true, unique: true, index: true },
  webhookUrl: { type: String },
  reviewedBy: { type: String },
  reviewNote: { type: String },
  reviewedAt: { type: Date },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

// Generate publicToken before saving
CheckpointSchema.pre('save', function() {
  if (!this.publicToken) {
    this.publicToken = `cp_${uuidv4().replace(/-/g, '')}`;
  }
});

export default mongoose.models.Checkpoint || mongoose.model<ICheckpoint>('Checkpoint', CheckpointSchema);
