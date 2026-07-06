/**
 * POST /v1/agents/[id]/rotate-key — rotate agent key (admin). Old key invalidated.
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { generateAgentKey } from '@/lib/v2/ids';
import Agent from '@/models/v2/Agent';
import ApiCredential from '@/models/v2/ApiCredential';

export const POST = createRoute<{ id: string }>({ admin: true }, async (ctx) => {
  const targetAgentId = ctx.params.id as string;
  const tenantId = ctx.resolved.tenantId;
  const agent = await Agent.findOne({ tenantId, agentId: targetAgentId }).lean();
  if (!agent) return Errors.notFound();

  const fullKey = generateAgentKey();

  await ApiCredential.updateMany(
    { tenantId, keyType: 'agent', agentId: targetAgentId },
    { $set: { active: false } },
  );
  await ApiCredential.create({
    apiKey: fullKey,
    keyPrefix: 'agutil_agt_',
    keyType: 'agent',
    tenantId,
    agentId: targetAgentId,
    active: true,
  });
  await Agent.updateOne({ tenantId, agentId: targetAgentId }, { $set: { apiKey: fullKey } });

  return { kind: 'ok' as const, data: { agent_id: targetAgentId, tenant_id: tenantId, api_key: fullKey } };
});
