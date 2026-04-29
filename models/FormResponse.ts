import mongoose, { Schema, Document } from 'mongoose';

export interface IFormResponse extends Document {
  formId: mongoose.Types.ObjectId;
  data: Record<string, unknown>;
  sourceIp: string;
  createdAt: Date;
  updatedAt: Date;
}

const FormResponseSchema = new Schema<IFormResponse>({
  formId: { type: Schema.Types.ObjectId, ref: 'AgentForm', required: true, index: true },
  data: { type: Schema.Types.Mixed, required: true },
  sourceIp: { type: String, default: '' },
}, { timestamps: true });

FormResponseSchema.index({ formId: 1, createdAt: -1 });

export default mongoose.models.FormResponse || mongoose.model<IFormResponse>('FormResponse', FormResponseSchema);
