import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IApiKey extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  key: string;
  tier: string;
  active: boolean;
  monthlyCount: number;
  monthStartedAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true, index: true },
  tier: { type: String, enum: ['free', 'builder', 'pro', 'enterprise'], default: 'free' },
  active: { type: Boolean, default: true },
  monthlyCount: { type: Number, default: 0 },
  monthStartedAt: { type: Date },
  lastUsedAt: { type: Date },
}, { timestamps: true });

// Generate API key before saving
ApiKeySchema.pre('save', function() {
  if (!this.key) {
    this.key = `au_${uuidv4().replace(/-/g, '')}`;
  }
});

export default mongoose.models.ApiKey || mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
