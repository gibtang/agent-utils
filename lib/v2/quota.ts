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
  auditRetentionDays: number;
}

export const QUOTAS: Record<'free' | 'pro', QuotaConfig> = {
  free: {
    agents: 3,
    kvKeys: 5000,
    kvStorageBytes: 10 * 1024 * 1024,
    schedulesActive: 10,
    dlqItems: 500,
    checkpointsPending: 5,
    auditRetentionDays: 7,
  },
  pro: {
    agents: 50,
    kvKeys: 100_000,
    kvStorageBytes: 2 * 1024 * 1024 * 1024,
    schedulesActive: 1000,
    dlqItems: 20_000,
    checkpointsPending: 50,
    auditRetentionDays: 30,
  },
};

export function quotaFor(plan: string): QuotaConfig {
  return QUOTAS[(plan as 'free' | 'pro')] ?? QUOTAS.free;
}

/**
 * Atomically reserve 1 unit of a counted quota. Returns true if allowed.
 * Used for agents, schedules_active, checkpoints_pending.
 */
export async function reserveCountedQuota(
  tenantId: string,
  plan: string,
  field: 'agentCount' | 'activeScheduleCount' | 'pendingCheckpointCount' | 'dlqItemCount',
  quotaKey: 'agents' | 'schedulesActive' | 'checkpointsPending' | 'dlqItems',
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
  field: 'agentCount' | 'activeScheduleCount' | 'pendingCheckpointCount' | 'dlqItemCount',
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
