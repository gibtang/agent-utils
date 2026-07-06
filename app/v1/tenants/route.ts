/**
 * POST /v1/tenants — create tenant + one-time admin key. Public endpoint.
 * GET not supported here (list not in PRD).
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { resourceId, generateAdminKey } from '@/lib/v2/ids';
import { randomSecret } from '@/lib/v2/crypto';
import Tenant, { TenantStatus, TenantPlan } from '@/models/v2/Tenant';
import ApiCredential from '@/models/v2/ApiCredential';

const NAME_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CreateTenantBody {
  name: string;
  owner_email: string;
  plan: 'free' | 'pro';
}

export const POST = createRoute({ public: true, idempotent: 'POST /v1/tenants' }, async (ctx) => {
  const body = (ctx.body ?? {}) as Partial<CreateTenantBody>;
  const name = body.name?.trim();
  const ownerEmail = body.owner_email?.trim();
  const plan = body.plan ?? 'free';

  if (!name || !NAME_RE.test(name)) {
    return Errors.validation('name must be 3–32 chars, lowercase alphanumeric/hyphens', { field: 'name' });
  }
  if (!ownerEmail || !EMAIL_RE.test(ownerEmail)) {
    return Errors.validation('owner_email must be a valid email', { field: 'owner_email' });
  }
  if (plan !== 'free' && plan !== 'pro') {
    return Errors.validation('plan must be "free" or "pro"', { field: 'plan' });
  }

  const tenantId = resourceId('ten_');
  const fullAdminKey = generateAdminKey();

  try {
    await Tenant.create({
      tenantId,
      name,
      ownerEmail,
      plan: plan as TenantPlan,
      status: 'active' as TenantStatus,
      adminKey: fullAdminKey,
      callbackSecret: randomSecret(),
    });
  } catch (e) {
    const err = e as { code?: number; message?: string };
    if (err.code === 11000 || /E11000|duplicate/i.test(err.message || '')) {
      return Errors.tenantNameTaken();
    }
    throw e;
  }

  await ApiCredential.create({
    apiKey: fullAdminKey,
    keyPrefix: 'agutil_adm_',
    keyType: 'admin',
    tenantId,
    agentId: null,
    active: true,
  });

  const tenant = await Tenant.findOne({ tenantId }).lean();
  void tenant;

  return {
    kind: 'created' as const,
    data: {
      tenant_id: tenantId,
      name,
      owner_email: ownerEmail,
      plan,
      status: 'active',
      admin_key: fullAdminKey,
      created_at: new Date().toISOString(),
    },
  };
});
