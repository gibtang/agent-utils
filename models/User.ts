import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionTier = 'free' | 'builder' | 'pro' | 'enterprise';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'none';

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  name: string;
  tier: SubscriptionTier;
  active: boolean;
  stripeCustomerId: string;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  tier: { type: String, enum: ['free', 'builder', 'pro', 'enterprise'], default: 'free' },
  active: { type: Boolean, default: true },
  stripeCustomerId: { type: String, default: '' },
  subscriptionId: { type: String, default: '' },
  subscriptionStatus: { type: String, enum: ['active', 'past_due', 'canceled', 'trialing', 'none'], default: 'none' },
  billingCycleStart: { type: Date },
  billingCycleEnd: { type: Date },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
