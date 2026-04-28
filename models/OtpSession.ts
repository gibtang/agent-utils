import mongoose, { Schema, Document } from 'mongoose';

export type OtpStatus = 'waiting' | 'received' | 'expired';

export interface IOtpSession extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  phoneNumber: string;
  phoneNumberSid?: string;
  code?: string;
  codeBody?: string;
  senderNumber?: string;
  status: OtpStatus;
  expiresAt: Date;
  receivedAt?: Date;
  createdAt: Date;
}

const OtpSessionSchema = new Schema<IOtpSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  phoneNumber: { type: String, required: true },
  phoneNumberSid: { type: String },
  code: { type: String },
  codeBody: { type: String },
  senderNumber: { type: String },
  status: { type: String, enum: ['waiting', 'received', 'expired'], default: 'waiting', index: true },
  expiresAt: { type: Date, required: true, index: true },
  receivedAt: { type: Date },
}, { timestamps: true });

OtpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.OtpSession || mongoose.model<IOtpSession>('OtpSession', OtpSessionSchema);
