/**
 * POST /v1/agents — register an agent under the calling admin's tenant.
 * GET not in PRD (agent list is admin's own tenant via dashboard, deferred).
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { generateAgentKey } from '@/lib/v2/ids';
import Agent, { RESERVED_AGENT_NAMES } from '@/models/v2/Agent';
import ApiCredential from '@/models/v2/ApiCredential';
import { reserveCountedQuota } from '@/lib/v2/quota';

const NAME_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;
const HTTPS_RE = /^https:\/\/.+/i;

interface RegisterAgentBody {
  name: string;
  description?: string;
  callback_base_url?: string;
}

export const POST = createRoute({ admin: true, idempotent: 'POST /v1/agents' }, async (ctx) => {
  const tenantId = ctx.resolved.tenantId;
  const body = (ctx.body ?? {}) as Partial<RegisterAgentBody>;
  const name = body.name?.trim();

  if (!name || !NAME_RE.test(name)) {
    return Errors.validation('name must be 3–32 chars, lowercase alphanumeric/hyphens', { field: 'name' });
  }
  if (RESERVED_AGENT_NAMES.has(name)) {
    return Errors.validation('name "shared" is reserved', { field: 'name' });
  }
  if (body.description && body.description.length > 256) {
    return Errors.validation('description max 256 chars', { field: 'description' });
  }
  if (body.callback_base_url !== undefined && body.callback_base_url !== null) {
    if (typeof body.callback_base_url !== 'string' || !HTTPS_RE.test(body.callback_base_url) || body.callback_base_url.length > 2048) {
      return Errors.validation('callback_base_url must be a valid HTTPS URL', { field: 'callback_base_url' });
    }
  }

  // Quota (atomic).
  const quotaRes = await reserveCountedQuota(tenantId, ctx.resolved.plan, 'agentCount', 'agents');
  if (!quotaRes.ok) {
    return Errors.quotaExceeded('agents', quotaRes.used, quotaRes.limit);
  }

  const fullKey = generateAgentKey();

  try {
    await Agent.create({
      agentId: name,
      tenantId,
      description: body.description,
      callbackBaseUrl: body.callback_base_url,
      apiKey: fullKey,
    });
  } catch (e) {
    // Roll back the quota reservation on duplicate name / failure.
    await releaseAgentQuota(tenantId);
    const err = e as { code?: number; message?: string };
    if (err.code === 11000 || /E11000|duplicate/i.test(err.message || '')) {
      return Errors.agentNameTaken();
    }
    throw e;
  }

  await ApiCredential.create({
    apiKey: fullKey,
    keyPrefix: 'agutil_agt_',
    keyType: 'agent',
    tenantId,
    agentId: name,
    active: true,
  });

  return {
    kind: 'created' as const,
    data: {
      agent_id: name,
      tenant_id: tenantId,
      api_key: fullKey,
      callback_base_url: body.callback_base_url ?? null,
      created_at: new Date().toISOString(),
    },
  };
});

// local import to avoid circular with quota module for rollback
import { releaseCountedQuota } from '@/lib/v2/quota';
function releaseAgentQuota(tenantId: string) {
  return releaseCountedQuota(tenantId, 'agentCount');
}
