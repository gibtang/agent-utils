import mongoose, { Schema, Document } from 'mongoose';

export type NotificationStatus = 'sent' | 'failed';
export type NotificationPriority = 'urgent' | 'normal' | 'low';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  to: string;
  subject: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  resendId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  to:       { type: String, required: true },
  subject:  { type: String, required: true },
  message:  { type: String, required: true },
  priority: { type: String, enum: ['urgent', 'normal', 'low'], default: 'normal' },
  status:   { type: String, enum: ['sent', 'failed'], required: true, index: true },
  resendId: { type: String },
  error:    { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);
