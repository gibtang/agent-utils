import mongoose, { Schema, Document } from 'mongoose';

export interface IPiiSession extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  mappings: Map<string, string>; // placeholder -> original value
  expiresAt: Date;
  createdAt: Date;
}

const PiiSessionSchema = new Schema<IPiiSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  mappings: { type: Map, of: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

// Auto-delete expired sessions
PiiSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PiiSession || mongoose.model<IPiiSession>('PiiSession', PiiSessionSchema);
