/**
 * AgentUtils v2 — Confession model.
 *
 * A Confession is a human-reviewable item an agent surfaces for action. Creating
 * one persists it and enqueues a default email notification to the tenant's
 * reviewer; resolution fires a signed `confession.resolved` callback (mirrors
 * HitL Checkpoint semantics) and cancels any pending notification work.
 *
 * Status lifecycle:
 *   pending → resolved | cancelled | expired
 *
 * Reviewer access is granted via a short-lived ConfessionToken (magic link),
 * NOT by the confession URL itself — `/c/{id}` reveals nothing without a valid
 * token. See models/v2/ConfessionToken.ts and lib/v2/confessionTokens.ts.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type ConfessionStatus = 'pending' | 'resolved' | 'cancelled' | 'expired';
export type ConfessionUrgency = 'normal' | 'high' | 'blocking';
export type ConfessionDecision = 'approved' | 'rejected' | 'expired';

export interface IConfession extends Document {
  confessionId: string; // conf_xxx
  tenantId: string;
  agentId: string;
  title: string;
  summary: string | null;
  context: unknown; // arbitrary agent context (NOT shown in email/URL)
  urgency: ConfessionUrgency;
  status: ConfessionStatus;
  reviewerEmail: string | null; // resolved default at creation (tenant ownerEmail or override)
  callbackUrl: string;
  callbackPayload: unknown;
  expiresAt: Date; // confession-level expiry (auto-expire in tick)
  resolutionDecision: ConfessionDecision | null;
  resolutionBy: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  callbackDelivered: boolean;
  escalatedAt: Date | null; // set when escalation tier 1 fires
  expiresAtPurge: Date; // retention purge (30 days)
  createdAt: Date;
  updatedAt: Date;
}

const ConfessionSchema = new Schema<IConfession>(
  {
    confessionId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, default: null },
    context: { type: Schema.Types.Mixed, default: null },
    urgency: { type: String, enum: ['normal', 'high', 'blocking'], default: 'normal', required: true },
    status: { type: String, enum: ['pending', 'resolved', 'cancelled', 'expired'], required: true, index: true },
    reviewerEmail: { type: String, default: null },
    callbackUrl: { type: String, required: true },
    callbackPayload: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
    resolutionDecision: { type: String, enum: ['approved', 'rejected', 'expired'], default: null },
    resolutionBy: { type: String, default: null },
    resolutionNote: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    callbackDelivered: { type: Boolean, default: false },
    escalatedAt: { type: Date, default: null },
    expiresAtPurge: { type: Date, required: true },
  },
  { timestamps: true },
);

// Tenant inbox queries: list pending confessions for the dashboard.
ConfessionSchema.index({ tenantId: 1, status: 1, _id: -1 });
// Tick sweep: find pending confessions past their expiry.
ConfessionSchema.index({ status: 1, expiresAt: 1 });
// Retention purge.
ConfessionSchema.index({ expiresAtPurge: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.ConfessionV2 as mongoose.Model<IConfession>) ||
  mongoose.model<IConfession>('ConfessionV2', ConfessionSchema);
