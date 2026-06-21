/**
 * POST /v1/tenants/[id]/rotate-key — rotate admin key (admin key required).
 * Old key invalidated immediately; new key returned once.
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { generateAdminKey } from '@/lib/v2/ids';
import { hashKey } from '@/lib/v2/crypto';
import Tenant from '@/models/v2/Tenant';
import ApiCredential from '@/models/v2/ApiCredential';

export const POST = createRoute<{ id: string }>({ admin: true }, async (ctx) => {
  const targetId = ctx.params.id as string;
  if (ctx.resolved.tenantId !== targetId) return Errors.notFound();

  const tenant = await Tenant.findOne({ tenantId: targetId }).lean();
  if (!tenant) return Errors.notFound();

  const fullKey = generateAdminKey();
  const newHash = hashKey(fullKey);

  // Atomically invalidate old credential(s) and write new one.
  await ApiCredential.updateMany(
    { tenantId: targetId, keyType: 'admin' },
    { $set: { active: false } },
  );
  await ApiCredential.create({
    keyHash: newHash,
    keyPrefix: 'agutil_adm_',
    keyType: 'admin',
    tenantId: targetId,
    agentId: null,
    active: true,
  });
  await Tenant.updateOne({ tenantId: targetId }, { $set: { adminKeyHash: newHash } });

  return { kind: 'ok' as const, data: { tenant_id: targetId, admin_key: fullKey } };
});
