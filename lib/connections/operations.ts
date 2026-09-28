/**
 * Transport-neutral operation definitions for the connections domain.
 *
 * These are thin adapters over lib/connections/service.ts: the service stays
 * authoritative for behaviour; the definitions here describe the public
 * contract (schemas, errors, docs) and delegate execution. The HTTP routes
 * keep transport concerns — body parsing, authentication, rate limits,
 * envelopes — and hand execute() already-resolved context.
 *
 * Wire schemas are JSON-safe: Date values from the service views are
 * serialized to ISO 8601 strings at this boundary so the same definition can
 * drive OpenAPI, llms.txt and MCP without runtime-specific types.
 */
import { z } from 'zod';
import { registerOperation } from '@/lib/contracts/registry';
import type { OperationContext } from '@/lib/contracts/operation';
import {
  authenticateConnection,
  createAgent,
  getConnectionStatus,
  redeemPairingCode,
  renameAgent,
  type ConnectionActor,
} from '@/lib/connections/service';

// ---------------------------------------------------------------------------
// Wire schemas (JSON-safe views of the service types)
// ---------------------------------------------------------------------------

export const connectionViewSchema = z.object({
  connectionId: z.string().regex(/^conn_/),
  agentId: z.string(),
  accountId: z.string(),
  status: z.string(),
  runtime: z.string().nullable(),
  displayPrefix: z.string(),
  createdAt: z.iso.datetime(),
});

export const connectionStatusViewSchema = z.object({
  agentName: z.string(),
  connection: connectionViewSchema,
  plan: z.string(),
  capabilities: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Serialization helpers (service Date values -> ISO strings)
// ---------------------------------------------------------------------------

type SerializedConnectionView = z.infer<typeof connectionViewSchema>;

function serializeConnectionView(connection: {
  connectionId: string;
  agentId: string;
  accountId: string;
  status: string;
  runtime: string | null;
  displayPrefix: string;
  createdAt: Date | string;
}): SerializedConnectionView {
  return {
    connectionId: connection.connectionId,
    agentId: connection.agentId,
    accountId: connection.accountId,
    status: connection.status,
    runtime: connection.runtime,
    displayPrefix: connection.displayPrefix,
    createdAt: connection.createdAt instanceof Date ? connection.createdAt.toISOString() : connection.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Public: pair a runtime using a pairing code
// ---------------------------------------------------------------------------

registerOperation({
  name: 'pair_connection',
  summary: 'Pair a runtime with an agent using a pairing code.',
  description:
    'Exchanges a one-time pairing code for a connection credential. ' +
    'Codes are single-use and expire 10 minutes after issue. ' +
    'The HTTP route enforces per-account rate limits; exceed them and the call fails with plan_limit_reached.',
  actor: 'public',
  input: z.object({
    code: z.string().trim().min(1).max(256),
    runtimeVersion: z.string().trim().min(1).max(120).optional(),
  }),
  output: z.object({
    connection: connectionViewSchema,
    credential: z.string().regex(/^au_conn_/),
  }),
  errors: ['not_found', 'plan_limit_reached', 'validation_failed', 'temporarily_unavailable'] as const,
  http: { method: 'POST', path: '/v1/connections/pair' },
  mcp: { readOnly: false, destructive: false, idempotent: false },
  async execute(_context: OperationContext, input: { code: string; runtimeVersion?: string }) {
    const result = await redeemPairingCode(input);
    return { connection: serializeConnectionView(result.connection), credential: result.credential };
  },
});

// ---------------------------------------------------------------------------
// Connection: report the status of the calling connection
// ---------------------------------------------------------------------------

registerOperation({
  name: 'connection_status',
  summary: 'Return the status of the calling connection.',
  description:
    'Returns the connection record, the paired agent name, the account plan and the granted capabilities. ' +
    'Requires a valid connection credential (Bearer au_conn_…).',
  actor: 'connection',
  input: z.object({}),
  output: connectionStatusViewSchema,
  errors: ['authentication_required', 'connection_revoked', 'permission_denied', 'not_found', 'temporarily_unavailable'] as const,
  http: { method: 'GET', path: '/v1/connections/status' },
  mcp: { readOnly: true, destructive: false, idempotent: true },
  async execute(context: OperationContext) {
    const status = await getConnectionStatus(context.actor as ConnectionActor);
    return {
      agentName: status.agentName,
      connection: serializeConnectionView(status.connection),
      plan: status.plan,
      capabilities: [...status.capabilities],
    };
  },
});

// ---------------------------------------------------------------------------
// Owner: manage agents (owner-only operations have no http or mcp mapping;
// they are surfaced through owner-authenticated routes, never as MCP tools)
// ---------------------------------------------------------------------------

registerOperation({
  name: 'create_agent',
  summary: 'Create an agent owned by the account.',
  description: 'Creates a new agent. Names are unique per account. Owner-only: never exposed as an MCP tool.',
  actor: 'owner',
  input: z.object({ name: z.string().trim().min(1).max(80) }),
  output: z.object({
    agentId: z.string().regex(/^agt_/),
    accountId: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.iso.datetime(),
  }),
  errors: ['authentication_required', 'validation_failed', 'temporarily_unavailable'] as const,
  async execute(context: OperationContext, input: { name: string }) {
    const agent = await createAgent({ accountId: context.actor!.accountId }, input);
    return {
      agentId: agent.agentId,
      accountId: agent.accountId,
      name: agent.name,
      status: agent.status,
      createdAt: agent.createdAt.toISOString(),
    };
  },
});

registerOperation({
  name: 'rename_agent',
  summary: 'Rename an agent owned by the account.',
  description:
    'Renames an agent. Names are unique per account; unknown or cross-account ids are uniformly not found. ' +
    'Owner-only: never exposed as an MCP tool.',
  actor: 'owner',
  input: z.object({ agentId: z.string().min(1), name: z.string().trim().min(1).max(80) }),
  output: z.object({
    agentId: z.string().regex(/^agt_/),
    accountId: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.iso.datetime(),
  }),
  errors: ['authentication_required', 'not_found', 'validation_failed', 'temporarily_unavailable'] as const,
  async execute(context: OperationContext, input: { agentId: string; name: string }) {
    const agent = await renameAgent({ accountId: context.actor!.accountId }, input.agentId, { name: input.name });
    return {
      agentId: agent.agentId,
      accountId: agent.accountId,
      name: agent.name,
      status: agent.status,
      createdAt: agent.createdAt.toISOString(),
    };
  },
});

export { authenticateConnection };
