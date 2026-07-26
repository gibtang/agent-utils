/**
 * AgentUtils v2 — per-tenant resource quotas (PRD §5.8).
 *
 * Enforced atomically via conditional findOneAndUpdate on the Tenant counter
 * fields, so R-QUOTA-2 holds: a limit of N is never exceeded by N+1 concurrent
 * creations.
 */
import connectDB from './db';
import Tenant, { ITenant } from '@/models/v2/Tenant';

export interface QuotaConfig {
  agents: number;
  kvKeys: number;
  kvStorageBytes: number;
  schedulesActive: number;
  dlqItems: number;
  checkpointsPending: number;
  confessionsPending: number;
  auditRetentionDays: number;
  confessionsMonthly: number;
}

export const QUOTAS: Record<'free' | 'pro', QuotaConfig> = {
  free: {
    agents: 3,
    kvKeys: 5000,
    kvStorageBytes: 10 * 1024 * 1024,
    schedulesActive: 10,
    dlqItems: 500,
    checkpointsPending: 5,
    confessionsPending: 25,
    auditRetentionDays: 7,
    confessionsMonthly: 10,
  },
  pro: {
    agents: 50,
    kvKeys: 100_000,
    kvStorageBytes: 2 * 1024 * 1024 * 1024,
    schedulesActive: 1000,
    dlqItems: 20_000,
    checkpointsPending: 50,
    confessionsPending: 1000,
    auditRetentionDays: 30,
    // Pro remains bounded at 1,000/month so quota accounting is explicit and atomic.
    confessionsMonthly: 1000,
  },
};

export function quotaFor(plan: string): QuotaConfig {
  return QUOTAS[(plan as 'free' | 'pro')] ?? QUOTAS.free;
}

/** Atomically reserve one confession in the current UTC calendar month. */
export async function reserveMonthlyConfessionQuota(tenantId: string, plan: string, now = new Date()): Promise<{ ok: boolean; used: number; limit: number; month: string }> {
  await connectDB();
  const limit = quotaFor(plan).confessionsMonthly;
  const month = now.toISOString().slice(0, 7);
  const updated = await Tenant.findOneAndUpdate(
    { tenantId, $or: [{ confessionQuotaMonth: { $ne: month } }, { confessionMonthlyCount: { $lt: limit } }] },
    [{ $set: { confessionQuotaMonth: month, confessionMonthlyCount: { $cond: [{ $eq: ['$confessionQuotaMonth', month] }, { $add: [{ $ifNull: ['$confessionMonthlyCount', 0] }, 1] }, 1] } } }],
    { returnDocument: 'after', updatePipeline: true },
  ).lean() as (ITenant | null);
  return { ok: !!updated, used: updated?.confessionMonthlyCount ?? limit, limit, month };
}

/** Compensate a failed confession insert without decrementing a later month. */
export async function releaseMonthlyConfessionQuota(tenantId: string, month: string): Promise<void> {
  await connectDB();
  await Tenant.updateOne(
    { tenantId, confessionQuotaMonth: month, confessionMonthlyCount: { $gt: 0 } },
    { $inc: { confessionMonthlyCount: -1 } },
  );
}

/**
 * Atomically reserve 1 unit of a counted quota. Returns true if allowed.
 * Used for agents, schedules_active, checkpoints_pending.
 */
export async function reserveCountedQuota(
  tenantId: string,
  plan: string,
  field: 'agentCount' | 'activeScheduleCount' | 'pendingCheckpointCount' | 'pendingConfessionCount' | 'dlqItemCount',
  quotaKey: 'agents' | 'schedulesActive' | 'checkpointsPending' | 'confessionsPending' | 'dlqItems',
): Promise<{ ok: boolean; used: number; limit: number }> {
  await connectDB();
  const limit = quotaFor(plan)[quotaKey];
  // Conditional atomic increment: only increments if currently below limit.
  const updated = await Tenant.findOneAndUpdate(
    { tenantId, [field]: { $lt: limit } },
    { $inc: { [field]: 1 } },
    { returnDocument: "after" },
  ).lean();
  const used = (updated as (ITenant & { _id: unknown }) | null)?.[field] ?? limit + 1;
  return { ok: !!updated, used, limit };
}

/** Release 1 unit back to a counted quota (on delete/cancel/resolve). */
export async function releaseCountedQuota(
  tenantId: string,
  field: 'agentCount' | 'activeScheduleCount' | 'pendingCheckpointCount' | 'pendingConfessionCount' | 'dlqItemCount',
): Promise<void> {
  await connectDB();
  await Tenant.updateOne({ tenantId, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
}

/**
 * Atomically reserve KV key storage (count + bytes together).
 * Returns ok=false if either count or byte budget is exceeded.
 */
export async function reserveKvQuota(
  tenantId: string,
  plan: string,
  valueBytes: number,
): Promise<{ ok: boolean; used: number; limit: number }> {
  await connectDB();
  const q = quotaFor(plan);
  // Try atomic increment with combined conditional check.
  const updated = await Tenant.findOneAndUpdate(
    {
      tenantId,
      kvKeyCount: { $lt: q.kvKeys },
      $expr: { $lte: [{ $add: ['$kvStorageBytes', valueBytes] }, q.kvStorageBytes] },
    },
    { $inc: { kvKeyCount: 1, kvStorageBytes: valueBytes } },
    { returnDocument: "after" },
  ).lean();
  return { ok: !!updated, used: (updated as ITenant | null)?.kvKeyCount ?? q.kvKeys, limit: q.kvKeys };
}

/** Adjust KV counters on value overwrite (count unchanged, bytes delta). */
export async function adjustKvBytes(tenantId: string, byteDelta: number): Promise<void> {
  await connectDB();
  await Tenant.updateOne({ tenantId }, { $inc: { kvStorageBytes: byteDelta } });
}

/** Adjust KV counters on key delete (-1 count, -bytes). */
export async function releaseKvQuota(tenantId: string, valueBytes: number): Promise<void> {
  await connectDB();
  await Tenant.updateOne(
    { tenantId, kvKeyCount: { $gt: 0 } },
    { $inc: { kvKeyCount: -1, kvStorageBytes: -valueBytes } },
  );
}
