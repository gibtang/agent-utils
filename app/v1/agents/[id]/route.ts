/**
 * GET /v1/agents/[id]          — agent metadata (plaintext key). Admin or same-tenant agent.
 * POST /v1/agents/[id]/rotate-key — rotate agent key (admin).
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import Agent from '@/models/v2/Agent';

export const GET = createRoute<{ id: string }>({}, async (ctx) => {
  const targetAgentId = ctx.params.id as string;
  const tenantId = ctx.resolved.tenantId;
  // Both admin keys and agent keys within the tenant may read.
  const agent = await Agent.findOne({ tenantId, agentId: targetAgentId }).lean();
  if (!agent) return Errors.notFound();
  return {
    kind: 'ok' as const,
    data: {
      agent_id: agent.agentId,
      tenant_id: agent.tenantId,
      description: agent.description ?? null,
      callback_base_url: agent.callbackBaseUrl ?? null,
      api_key: agent.apiKey,
      created_at: agent.createdAt.toISOString(),
    },
  };
});
