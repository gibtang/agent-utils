import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookInbox extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  token: string;
  label?: string;
  forwardUrl?: string;
  messageCount: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookInboxSchema = new Schema<IWebhookInbox>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  token: { type: String, required: true, unique: true, index: true },
  label: { type: String },
  forwardUrl: { type: String },
  messageCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

WebhookInboxSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.WebhookInbox || mongoose.model<IWebhookInbox>('WebhookInbox', WebhookInboxSchema);
