/**
 * AgentUtils v2 — Confession magic-link token.
 *
 * Grants a single-Confession, single-purpose access grant to a human reviewer
 * who may not have (and must not need) a Firebase account. The plaintext token
 * is `ct_<32 random bytes hex>` and is ONLY ever held in the email link; the
 * DB stores the sha256 hash so a DB read cannot grant access.
 *
 * Scope:
 *   view    — load the /c/{id} review page (title/summary/context/actions)
 *   resolve — POST a decision (approved/rejected). Single-use: revoked on use.
 *
 * The review page enforces `view` to render and `resolve` to submit; both
 * require a non-expired, non-revoked token. TTL is 24h (issuance-only).
 */
import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'node:crypto';

export type ConfessionTokenScope = 'view' | 'resolve';

export interface IConfessionToken extends Document {
  tokenId: string; // ct_<plaintext>, shown once. NOT stored here — store the hash.
  tokenHash: string; // sha256 hex of the plaintext token
  confessionId: string;
  tenantId: string;
  scope: ConfessionTokenScope;
  expiresAt: Date;
  usedAt: Date | null; // set on first use (resolve scope revokes after use)
  createdAt: Date;
  updatedAt: Date;
}

/** sha256 hex of the plaintext token. */
export function hashConfessionToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

const ConfessionTokenSchema = new Schema<IConfessionToken>(
  {
    // tokenId is the plaintext shown once; we don't persist it. Field kept for
    // interface symmetry but stored as the hash below (unique lookup key).
    tokenId: { type: String, required: false },
    tokenHash: { type: String, required: true, unique: true, index: true },
    confessionId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    scope: { type: String, enum: ['view', 'resolve'], required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Tick/lookup sweep.
ConfessionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.ConfessionTokenV2 as mongoose.Model<IConfessionToken>) ||
  mongoose.model<IConfessionToken>('ConfessionTokenV2', ConfessionTokenSchema);
