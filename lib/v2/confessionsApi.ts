/**
 * AgentUtils v2 — Confession API serialization helper.
 *
 * Shared by the v1 confession routes (CRUD + resolve) so neither route imports
 * from the other. Produces the snake_case public API shape.
 */
import type { IConfession } from '@/models/v2/Confession';

export function serializeConfession(c: IConfession, opts?: { includeContext?: boolean }) {
  return {
    id: c.confessionId,
    agent_id: c.agentId,
    title: c.title,
    summary: c.summary ?? null,
    // Context may contain agent-internal data; only the creating agent sees it
    // via this authenticated endpoint. The public /c/{id} page never returns it.
    ...(opts?.includeContext ? { context: c.context ?? null } : {}),
    urgency: c.urgency,
    status: c.status,
    reviewer_email: c.reviewerEmail ?? null,
    expires_at: c.expiresAt instanceof Date ? c.expiresAt.toISOString() : c.expiresAt,
    callback_url: c.callbackUrl,
    escalated: !!c.escalatedAt,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    ...(c.status !== 'pending' && c.resolutionDecision
      ? {
          resolution: {
            decision: c.resolutionDecision,
            by: c.resolutionBy,
            note: c.resolutionNote,
            resolved_at: c.resolvedAt instanceof Date ? c.resolvedAt.toISOString() : c.resolvedAt,
          },
        }
      : {}),
  };
}
