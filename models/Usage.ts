import mongoose, { Schema, Document } from 'mongoose';

export interface IUsage extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  callsIncluded: number;
  callsOverage: number;
  overageCost: number; // cents
  toolBreakdown: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const UsageSchema = new Schema<IUsage>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  callsIncluded: { type: Number, default: 0 },
  callsOverage: { type: Number, default: 0 },
  overageCost: { type: Number, default: 0 }, // stored in cents
  toolBreakdown: { type: Map, of: Number, default: {} },
}, { timestamps: true });

// Compound index for fast current-period lookups (per-key)
UsageSchema.index({ apiKeyId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
// Keep userId index for billing rollup (aggregates all keys for a user)
UsageSchema.index({ userId: 1, periodStart: 1, periodEnd: 1 });

export default mongoose.models.Usage || mongoose.model<IUsage>('Usage', UsageSchema);
