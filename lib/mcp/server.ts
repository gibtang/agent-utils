/**
 * Remote MCP server (foundation Task 7).
 *
 * buildMcpServer(actor) turns the shared operation registry into an MCP
 * server. Every registry operation that carries mcp metadata becomes a tool;
 * the actor is fixed at construction time, so one actor serves one HTTP
 * session and there is no actor-independent execution path.
 *
 * Scope enforcement (the SDK's tools/list handler always lists everything it
 * is given, so both surfaces are gated here):
 * - LISTING: only operations visible to the constructed actor are listed —
 *   public operations for an actor-less server, public + connection
 *   operations for a connection-authenticated one. Owner-only operations
 *   never carry mcp metadata and are never registered at all.
 * - CALLS: an actor-less server answers every connection-scoped tool call
 *   with the catalogue-shaped authentication_required error instead of
 *   executing.
 *
 * Tool results follow the HTTP envelope convention: success is
 * {"data": …}, failures are {"error": {code, message, data_preserved,
 * retry_safe, next_action, request_id}} returned as isError results.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { normalizeObjectSchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import { ListToolsRequestSchema, type Tool, type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import { DomainError, Errors } from '@/lib/core/errors';
import { resourceId } from '@/lib/core/ids';
import { listMcpOperations } from '@/lib/contracts/registry';
import type { OperationActor, OperationContext, OperationDefinition } from '@/lib/contracts/operation';
import '@/lib/connections/operations';
import '@/lib/handoff/operations';

/** The caller resolved by the transport's auth step; undefined when public. */
type Actor = OperationContext['actor'];

/** An operation is visible when it is public or the session has any actor. */
function visibleTo(actor: Actor, operationActor: OperationActor): boolean {
  return operationActor === 'public' || actor !== undefined;
}

function toolAnnotations(op: OperationDefinition<unknown, unknown>): ToolAnnotations {
  const mcp = op.mcp as { readOnly: boolean; destructive: boolean; idempotent: boolean };
  return { readOnlyHint: mcp.readOnly, destructiveHint: mcp.destructive, idempotentHint: mcp.idempotent };
}

/** Build the wire Tool entry from the registry (single source of truth). */
function toolDefinition(op: OperationDefinition<unknown, unknown>): Tool {
  const objectSchema = normalizeObjectSchema(op.input as z.ZodType);
  if (!objectSchema) throw new Error(`MCP registry: operation "${op.name}" input must be an object schema.`);
  return {
    name: op.name,
    description: `${op.summary} ${op.description}`,
    inputSchema: toJsonSchemaCompat(objectSchema, { strictUnions: true, pipeStrategy: 'input' }) as Tool['inputSchema'],
    annotations: toolAnnotations(op),
  };
}

/** Catalogue-shaped JSON body for one tool failure. */
function errorBody(error: DomainError, requestId: string): string {
  return JSON.stringify({
    error: {
      code: error.code,
      message: error.message,
      data_preserved: error.dataPreserved,
      retry_safe: error.retrySafe,
      next_action: error.nextAction,
      request_id: requestId,
    },
  });
}

export function buildMcpServer(actor: Actor): McpServer {
  const server = new McpServer(
    { name: 'agent-utils', version: '0.1.0' },
    {
      instructions:
        'AgentUtils operations over MCP. Pair with a pairing code, then reconnect with your au_conn_ credential to unlock connection-scoped tools.',
    },
  );

  // ------------------------------------------------------------------
  // Register every registry operation that carries mcp metadata. The
  // actor for all executions is fixed at construction time.
  // ------------------------------------------------------------------
  for (const op of listMcpOperations()) {
    server.registerTool(
      op.name,
      {
        description: `${op.summary} ${op.description}`,
        // The SDK accepts an already-constructed zod schema (its AnySchema
        // branch) and derives handler argument typing from it.
        inputSchema: op.input as z.ZodType,
        annotations: toolAnnotations(op),
      },
      async (args: unknown) => {
        const requestId = resourceId('req_');
        // Never execute without an actor: connection-scoped operations fail
        // with the documented catalogue error instead of running publicly.
        if (actor === undefined && op.actor !== 'public') {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: errorBody(Errors.authenticationRequired(), requestId) }],
          };
        }
        try {
          const output = await op.execute({ actor, requestId }, args as never);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ data: output }) }],
          };
        } catch (error) {
          const domainError = error instanceof DomainError ? error : Errors.temporarilyUnavailable();
          return {
            isError: true,
            content: [{ type: 'text' as const, text: errorBody(domainError, requestId) }],
          };
        }
      },
    );
  }

  // ------------------------------------------------------------------
  // Actor-scoped listing: the SDK's default tools/list handler returns
  // every registered tool, so replace it (officially supported) with a
  // filtered view derived from the same registry.
  // ------------------------------------------------------------------
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: listMcpOperations()
      .filter((op) => visibleTo(actor, op.actor))
      .map((op) => toolDefinition(op)),
  }));

  return server;
}
