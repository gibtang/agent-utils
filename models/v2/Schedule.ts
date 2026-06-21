/**
 * AgentUtils v2 — Schedule (PRD §9). `once` schedules only.
 *
 * Status: pending → fired (first 2xx) | cancelled | failed (all retries exhausted).
 */
import mongoose, { Schema, Document } from 'mongoose';

export type ScheduleStatus = 'pending' | 'fired' | 'cancelled' | 'failed';

export interface ISchedule extends Document {
  scheduleId: string; // sched_xxx
  tenantId: string;
  agentId: string;
  callbackUrl: string;
  callbackPayload: unknown;
  fireAt: Date;
  status: ScheduleStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
  firedAt: Date | null;
  dlqOnFailure: boolean;
  label: string | null;
  expiresAt: Date; // retention purge
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    scheduleId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    callbackUrl: { type: String, required: true },
    callbackPayload: { type: Schema.Types.Mixed, default: null },
    fireAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['pending', 'fired', 'cancelled', 'failed'], required: true, index: true },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    firedAt: { type: Date, default: null },
    dlqOnFailure: { type: Boolean, default: true },
    label: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

ScheduleSchema.index({ status: 1, fireAt: 1 });
ScheduleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.ScheduleV2 as mongoose.Model<ISchedule>) ||
  mongoose.model<ISchedule>('ScheduleV2', ScheduleSchema);
