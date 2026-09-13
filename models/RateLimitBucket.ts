import mongoose, { type InferSchemaType } from 'mongoose';

const RateLimitBucketSchema = new mongoose.Schema({
  scope: { type: String, required: true },
  identifier: { type: String, required: true },
  windowStart: { type: Date, required: true },
  expireAt: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
}, { versionKey: false });
RateLimitBucketSchema.index({ scope: 1, identifier: 1, windowStart: 1 }, { unique: true });
RateLimitBucketSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
export type RateLimitBucketDocument = InferSchemaType<typeof RateLimitBucketSchema>;
export default (mongoose.models.RateLimitBucket as mongoose.Model<RateLimitBucketDocument> | undefined) ?? mongoose.model<RateLimitBucketDocument>('RateLimitBucket', RateLimitBucketSchema);
