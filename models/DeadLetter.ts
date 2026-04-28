import mongoose, { Schema, Document } from 'mongoose';

export type DeadLetterStatus = 'pending' | 'retried' | 'resolved' | 'dismissed';

export interface IDeadLetter extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  agentName: string;
  taskType: string;
  payload: Record<string, unknown>;
  error: string;
  errorStack?: string;
  status: DeadLetterStatus;
  retryCount: number;
  retryWebhook?: string;
  tags?: string[];
  resolvedAt?: Date;
  createdAt: Date;
}

const DeadLetterSchema = new Schema<IDeadLetter>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  agentName: { type: String, default: 'unknown' },
  taskType: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  error: { type: String, required: true },
  errorStack: { type: String },
  status: { type: String, enum: ['pending', 'retried', 'resolved', 'dismissed'], default: 'pending', index: true },
  retryCount: { type: Number, default: 0 },
  retryWebhook: { type: String },
  tags: [{ type: String }],
  resolvedAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.DeadLetter || mongoose.model<IDeadLetter>('DeadLetter', DeadLetterSchema);
