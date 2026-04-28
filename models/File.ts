import mongoose, { Schema, Document } from 'mongoose';

export interface IFile extends Document {
  storageId: string;
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  originalName: string;
  contentType: string;
  size: number;
  expiresAt: Date;
  createdAt: Date;
}

const FileSchema = new Schema<IFile>({
  storageId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  originalName: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: true }, // TTL index for auto-cleanup
}, { timestamps: true });

// Auto-delete expired files (MongoDB TTL index)
FileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.File || mongoose.model<IFile>('File', FileSchema);
