import mongoose, { Schema, Document } from 'mongoose';

export interface IKvEntry extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  key: string;
  value: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KvEntrySchema = new Schema<IKvEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  key: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Compound unique: one key per API key
KvEntrySchema.index({ apiKeyId: 1, key: 1 }, { unique: true });
// Auto-delete expired entries
KvEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.KvEntry || mongoose.model<IKvEntry>('KvEntry', KvEntrySchema);
