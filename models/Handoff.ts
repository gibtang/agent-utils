import mongoose, { type InferSchemaType } from 'mongoose';
import { resourceId } from '@/lib/core/ids';

const HandoffFieldSchema = new mongoose.Schema({
  name: { type: String, required: true, match: /^[a-z0-9_]{1,64}$/ },
  label: { type: String, required: true, maxlength: 120 },
  helpText: { type: String, default: null, maxlength: 240 },
  type: { type: String, required: true, enum: ['email', 'text', 'password', 'textarea'] },
  required: { type: Boolean, required: true },
  prefill: { type: String, default: null, maxlength: 256 },
}, { _id: false });

const HandoffSchema = new mongoose.Schema({
  handoffId: { type: String, required: true, unique: true, default: () => resourceId('cv_') },
  accountId: { type: String, required: true, index: true },
  agentId: { type: String, required: true, index: true },
  connectionId: { type: String, required: true, index: true },
  status: { type: String, enum: ['awaiting', 'submitted', 'closed', 'expired'], default: 'awaiting' },
  closureReason: { type: String, enum: ['done', 'revoked'], default: null },
  title: { type: String, default: null, maxlength: 120 },
  fieldSchema: {
    type: [HandoffFieldSchema], required: true,
    validate: [
      (fields: Array<{ name: string; type: string; prefill?: string | null }>) => fields.length <= 12,
      'fieldSchema may contain at most 12 fields',
    ],
  },
  viewTokenHash: { type: String, required: true, unique: true },
  submitTokenHash: { type: String, required: true, unique: true },
  linkExpiresAt: { type: Date, required: true },
  sessionExpiresAt: { type: Date, required: true },
  retrievalCount: { type: Number, default: 0, min: 0 },
  lastRetrievedAt: { type: Date, default: null },
  callbackUrl: { type: String, default: null },
  callbackSecretHash: { type: String, default: null },
  submitIpHash: { type: String, default: null },
  ciphertext: { type: String, default: null },
  iv: { type: String, default: null },
  tag: { type: String, default: null },
  expiresAtPurge: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

HandoffSchema.path('fieldSchema').validate((fields: Array<{ name: string; type: string; prefill?: string | null }>) => {
  const names = new Set<string>();
  return fields.every((field) => {
    if (names.has(field.name) || (field.type === 'password' && field.prefill != null)) return false;
    names.add(field.name);
    return true;
  });
}, 'field names must be unique and password fields cannot have prefill');
HandoffSchema.index({ accountId: 1, status: 1 });
HandoffSchema.index({ expiresAtPurge: 1 }, { expireAfterSeconds: 0 });

export type HandoffDocument = InferSchemaType<typeof HandoffSchema>;
export default (mongoose.models.Handoff as mongoose.Model<HandoffDocument> | undefined) ?? mongoose.model<HandoffDocument>('Handoff', HandoffSchema);
