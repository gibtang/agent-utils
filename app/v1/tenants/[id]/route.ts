/**
 * GET /v1/tenants/[id]          — tenant metadata + quota usage (admin key)
 * DELETE /v1/tenants/[id]       — schedule deletion (admin key)
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import Tenant from '@/models/v2/Tenant';
import { quotaFor } from '@/lib/v2/quota';

export const GET = createRoute<{ id: string }>({ admin: true }, async (ctx) => {
  const targetId = ctx.params.id as string;
  if (ctx.resolved.tenantId !== targetId) {
    // Admin key may only read its own tenant. Cross-tenant → 404 (no existence leak).
    return Errors.notFound();
  }
  const tenant = await Tenant.findOne({ tenantId: targetId }).lean();
  if (!tenant) return Errors.notFound();
  const q = quotaFor(tenant.plan);
  return {
    kind: 'ok' as const,
    data: {
      tenant_id: tenant.tenantId,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      quota_usage: {
        agents: { used: tenant.agentCount, limit: q.agents },
        kv_keys: { used: tenant.kvKeyCount, limit: q.kvKeys },
        kv_storage_bytes: { used: tenant.kvStorageBytes, limit: q.kvStorageBytes },
        schedules_active: { used: tenant.activeScheduleCount, limit: q.schedulesActive },
        dlq_items: { used: tenant.dlqItemCount, limit: q.dlqItems },
        checkpoints_pending: { used: tenant.pendingCheckpointCount, limit: q.checkpointsPending },
        audit_retention_days: q.auditRetentionDays,
      },
      created_at: tenant.createdAt.toISOString(),
    },
  };
});

export const DELETE = createRoute<{ id: string }>({ admin: true }, async (ctx) => {
  const targetId = ctx.params.id as string;
  if (ctx.resolved.tenantId !== targetId) {
    return Errors.notFound();
  }
  const body = (ctx.body ?? {}) as { confirm?: string };
  if (body.confirm !== 'DELETE ALL DATA') {
    return Errors.validation('Request body must include {"confirm":"DELETE ALL DATA"}', { field: 'confirm' });
  }
  const result = await Tenant.updateOne(
    { tenantId: targetId, status: { $ne: 'pending_deletion' } },
    { $set: { status: 'pending_deletion', deletedAt: new Date() } },
  );
  if (result.matchedCount === 0) return Errors.notFound();
  return { kind: 'noContent' as const };
});
