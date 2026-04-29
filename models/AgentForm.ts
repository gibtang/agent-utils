import mongoose, { Schema, Document } from 'mongoose';

export type FormStatus = 'active' | 'paused' | 'expired';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: string[]; // for select type
  placeholder?: string;
}

export interface IAgentForm extends Document {
  userId: mongoose.Types.ObjectId;
  apiKeyId: mongoose.Types.ObjectId;
  token: string;
  title: string;
  fields: FormField[];
  webhookUrl: string;
  status: FormStatus;
  responseCount: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AgentFormSchema = new Schema<IAgentForm>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  token: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  fields: { type: Schema.Types.Mixed, required: true },
  webhookUrl: { type: String, required: true },
  status: { type: String, enum: ['active', 'paused', 'expired'], default: 'active', index: true },
  responseCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

AgentFormSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AgentForm || mongoose.model<IAgentForm>('AgentForm', AgentFormSchema);
