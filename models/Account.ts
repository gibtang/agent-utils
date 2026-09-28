import mongoose, { type InferSchemaType } from 'mongoose';
import { resourceId } from '@/lib/core/ids';
import type { PlanName } from '@/lib/billing/plans';

const AccountSchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true, default: () => resourceId('acct_') },
  ownerUid: { type: String, required: true, unique: true, index: true },
  ownerEmail: { type: String, default: null },
  ownerDisplayName: { type: String, default: null },
  ownerPhotoUrl: { type: String, default: null },
  plan: { type: String, enum: ['free', 'plus', 'pro'], default: 'free' },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
  suspendedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  stateBytesUsed: { type: Number, default: 0, min: 0 },
  fileBytesUsed: { type: Number, default: 0, min: 0 },
  stripeCustomerId: { type: String, default: null },
  stripeSubscriptionId: { type: String, default: null },
  stripeSubscriptionStatus: { type: String, default: null },
  currentPeriodEnd: { type: Date, default: null },
  downgradeAt: { type: Date, default: null },
  pendingPlan: { type: String, enum: ['free', 'plus', 'pro'], default: null },
  handoffDek: { type: String, default: null },
}, { timestamps: true, versionKey: false });

export type AccountDocument = InferSchemaType<typeof AccountSchema> & { plan: PlanName };
export default (mongoose.models.Account as mongoose.Model<AccountDocument> | undefined) ?? mongoose.model<AccountDocument>('Account', AccountSchema);
