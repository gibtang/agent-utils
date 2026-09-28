import mongoose, { type InferSchemaType } from 'mongoose';
import { resourceId } from '@/lib/core/ids';

const PairingCodeSchema = new mongoose.Schema({
  pairingCodeId: { type: String, required: true, unique: true, default: () => resourceId('pair_') },
  codeHash: { type: String, required: true, unique: true },
  accountId: { type: String, required: true, index: true },
  agentId: { type: String, required: true, index: true },
  runtimeHint: { type: String, default: null },
  expiresAt: { type: Date, required: true },
  redeemedAt: { type: Date, default: null },
  redemptionConnectionId: { type: String, default: null },
}, { timestamps: true, versionKey: false });
PairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PairingCodeDocument = InferSchemaType<typeof PairingCodeSchema>;
export default (mongoose.models.PairingCode as mongoose.Model<PairingCodeDocument> | undefined) ?? mongoose.model<PairingCodeDocument>('PairingCode', PairingCodeSchema);
