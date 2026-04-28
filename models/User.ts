import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  name: string;
  tier: SubscriptionTier;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  tier: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
