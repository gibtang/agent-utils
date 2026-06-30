/**
 * AgentUtils v2 — User model.
 *
 * A User is a Firebase-authenticated account (email/password or Google OAuth).
 * Each user is linked 1:1 to a hidden Tenant (`tenantId`) that owns all their
 * tool data and API keys. The tenant is an invisible internal implementation
 * detail — the user-facing model is simply "you have API keys".
 *
 * `firebaseUid` is sparse + unique: the only required identity. Email is
 * denormalised for display; the source of truth for identity is Firebase Auth.
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firebaseUid: string; // Firebase Auth UID (unique)
  email: string; // denormalised display email
  displayName?: string;
  photoURL?: string;
  tenantId: string; // ten_xxx — the user's hidden internal account
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    displayName: { type: String },
    photoURL: { type: String },
    tenantId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

export default (mongoose.models.UserV2 as mongoose.Model<IUser>) ||
  mongoose.model<IUser>('UserV2', UserSchema);
