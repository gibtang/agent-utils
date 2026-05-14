import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookMessage extends Document {
  inboxId: mongoose.Types.ObjectId;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  sourceIp: string;
  contentType: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookMessageSchema = new Schema<IWebhookMessage>({
  inboxId: { type: Schema.Types.ObjectId, ref: 'WebhookInbox', required: true, index: true },
  method: { type: String, required: true },
  headers: { type: Schema.Types.Mixed, default: {} },
  body: { type: Schema.Types.Mixed },
  query: { type: Schema.Types.Mixed, default: {} },
  sourceIp: { type: String, default: '' },
  contentType: { type: String, default: '' },
}, { timestamps: true });

WebhookMessageSchema.index({ inboxId: 1, createdAt: -1 });

export default mongoose.models.WebhookMessage || mongoose.model<IWebhookMessage>('WebhookMessage', WebhookMessageSchema);
