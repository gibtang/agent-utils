/**
 * Shared handoff operation definitions. Submit is intentionally absent: it is
 * a possession-token public form action (Task 5), not a connection/MCP tool.
 * Decrypt and status use POST bodies containing handoffId rather than path
 * parameters because the registry's transport-neutral input is one object.
 */
import { z } from 'zod';
import { registerOperation } from '@/lib/contracts/registry';
import type { OperationContext } from '@/lib/contracts/operation';
import { createHandoff, closeHandoff, decryptHandoff, statusHandoff, type ConnectionActor } from '@/lib/handoff/service';
import { handoffFieldSchemaArraySchema } from '@/lib/handoff/schemas';

const handoffIdSchema = z.string().trim().min(1).max(128);
const metadataSchema = z.object({
  handoffId: z.string(),
  status: z.enum(['awaiting', 'submitted', 'closed', 'expired']),
  closureReason: z.enum(['done', 'revoked']).nullable(),
  retrievalCount: z.number().int().nonnegative(),
  linkExpiresAt: z.iso.datetime(),
  sessionExpiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

const actorFor = (context: OperationContext): ConnectionActor => context.actor as ConnectionActor;
const iso = (date: Date) => date.toISOString();

registerOperation({
  name: 'handoff_create',
  summary: 'Create a secure credential handoff link.',
  description: 'Creates a handoff owned by the calling connection and returns its one-time view and submit tokens. The HTTP route applies connection rate limits.',
  actor: 'connection',
  input: z.object({ fieldSchema: handoffFieldSchemaArraySchema, title: z.string().trim().max(120).optional(), linkTtlHours: z.number().min(0.5).max(24).optional(), callbackUrl: z.url().optional() }),
  output: z.object({ handoffId: z.string(), linkPath: z.string(), linkExpiresAt: z.iso.datetime(), submitToken: z.string(), viewToken: z.string(), callbackSecret: z.string().optional() }),
  errors: ['validation_failed', 'permission_denied', 'temporarily_unavailable'] as const,
  http: { method: 'POST', path: '/v1/handoffs' },
  mcp: { readOnly: false, destructive: false, idempotent: false },
  async execute(context, input) {
    const result = await createHandoff(actorFor(context), input);
    return { ...result, linkExpiresAt: iso(result.linkExpiresAt) };
  },
});

registerOperation({
  name: 'handoff_decrypt',
  summary: 'Decrypt values submitted to a handoff created by this connection.',
  description: 'Returns plaintext values only to the creating connection. Uses POST /v1/handoffs/decrypt with handoffId in the body so the shared registry has a single JSON input schema.',
  actor: 'connection',
  input: z.object({ handoffId: handoffIdSchema }),
  output: z.record(z.string(), z.string().max(4096)),
  errors: ['not_found', 'resource_expired', 'resource_deleted', 'permission_denied', 'authentication_required', 'temporarily_unavailable'] as const,
  http: { method: 'POST', path: '/v1/handoffs/decrypt' },
  mcp: { readOnly: false, destructive: false, idempotent: true },
  async execute(context, input) { return decryptHandoff(input.handoffId, actorFor(context)); },
});

registerOperation({
  name: 'handoff_close',
  summary: 'Close a handoff created by this connection.',
  description: 'Crypto-erases a handoff with the done reason. Owner revocation is intentionally owner-route-only and is never an MCP operation.',
  actor: 'connection',
  input: z.object({ handoffId: handoffIdSchema, reason: z.enum(['done']) }),
  output: z.object({ closed: z.literal(true) }),
  errors: ['not_found', 'resource_deleted', 'permission_denied', 'validation_failed', 'temporarily_unavailable'] as const,
  http: { method: 'POST', path: '/v1/handoffs/close' },
  mcp: { readOnly: false, destructive: true, idempotent: true },
  async execute(context, input) { await closeHandoff(input.handoffId, actorFor(context), input.reason); return { closed: true }; },
});

registerOperation({
  name: 'handoff_status',
  summary: 'Return metadata-only status for an account handoff.',
  description: 'Any connection in the owning account may poll non-secret metadata. Uses POST /v1/handoffs/status with handoffId in the body; it never returns field values, tokens, or ciphertext metadata.',
  actor: 'connection',
  input: z.object({ handoffId: handoffIdSchema }),
  output: metadataSchema,
  errors: ['not_found', 'authentication_required', 'temporarily_unavailable'] as const,
  http: { method: 'POST', path: '/v1/handoffs/status' },
  mcp: { readOnly: true, destructive: false, idempotent: true },
  async execute(context, input) {
    const result = await statusHandoff(input.handoffId, actorFor(context));
    return { ...result, linkExpiresAt: iso(result.linkExpiresAt), sessionExpiresAt: iso(result.sessionExpiresAt), createdAt: iso(result.createdAt) };
  },
});

export { metadataSchema as handoffMetadataSchema };
