/**
 * POST /v1/approval-keys — admin creates a scoped approval-proxy key.
 * These keys can only approve/reject checkpoints within the tenant.
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { generateApprovalProxyKey } from '@/lib/v2/ids';
import ApiCredential from '@/models/v2/ApiCredential';

export const POST = createRoute({ admin: true }, async (ctx) => {
  const body = (ctx.body ?? {}) as { name?: string };
  const name = body.name?.trim() || 'approval-proxy';
  if (name.length > 128) return Errors.validation('name max 128 chars', { field: 'name' });

  const fullKey = generateApprovalProxyKey();
  await ApiCredential.create({
    apiKey: fullKey,
    keyPrefix: 'agutil_apr_',
    keyType: 'approval-proxy',
    tenantId: ctx.resolved.tenantId,
    agentId: null,
    active: true,
  });
  return {
    kind: 'created' as const,
    data: {
      approval_key: fullKey,
      name,
      tenant_id: ctx.resolved.tenantId,
      scope: 'checkpoint:approve,reject',
    },
  };
});
