import mongoose, { type InferSchemaType } from 'mongoose';
import { resourceId } from '@/lib/core/ids';

/** Safe audit trail: metadata must contain event context only, never submitted values or credentials. */
const ActivitySchema = new mongoose.Schema({
  activityId: { type: String, required: true, unique: true, default: () => resourceId('activity_') },
  accountId: { type: String, required: true, index: true },
  agentId: { type: String, default: null },
  handoffId: { type: String, default: null },
  event: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

ActivitySchema.index({ accountId: 1, createdAt: 1 });

export type ActivityDocument = InferSchemaType<typeof ActivitySchema>;
export default (mongoose.models.Activity as mongoose.Model<ActivityDocument> | undefined) ?? mongoose.model<ActivityDocument>('Activity', ActivitySchema);
