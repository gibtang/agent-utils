import mongoose, { Schema, Document } from 'mongoose';

export interface IUsage extends Document {
  userId: mongoose.Types.ObjectId;
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
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  callsIncluded: { type: Number, default: 0 },
  callsOverage: { type: Number, default: 0 },
  overageCost: { type: Number, default: 0 }, // stored in cents
  toolBreakdown: { type: Map, of: Number, default: {} },
}, { timestamps: true });

// Compound index for fast current-period lookups
UsageSchema.index({ userId: 1, periodStart: 1, periodEnd: 1 });

export default mongoose.models.Usage || mongoose.model<IUsage>('Usage', UsageSchema);
