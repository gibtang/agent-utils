import type { z } from 'zod';
import type { ERROR_CATALOGUE } from '@/lib/core/errors';

/** Error codes exposed in the public contract (mirrors ERROR_CATALOGUE keys). */
export type PublicErrorCode = keyof typeof ERROR_CATALOGUE;

/** Actor kinds: public (unauthenticated), connection (agent credential), owner (account owner). */
export type OperationActor = 'public' | 'connection' | 'owner';

/** What a resolved caller looks like when an operation executes. */
export interface OperationContext {
  actor?: {
    accountId: string;
    ownerUid?: string;
    connectionId?: string;
    agentId?: string;
  };
  requestId: string;
}

/**
 * Transport-neutral operation definition. One registry feeds HTTP routes, MCP
 * tools, OpenAPI and llms.txt, so a single source of truth describes every
 * callable operation.
 */
export interface OperationDefinition<I, O> {
  /** Stable identifier, e.g. `pair_connection`. */
  name: string;
  /** One-line summary shown in generated docs. */
  summary: string;
  /** Longer prose description; embeds transport notes (rate limits etc.). */
  description: string;
  /** Which actor may call this operation. */
  actor: OperationActor;
  /** Zod schema validating the operation input. */
  input: z.ZodType<I>;
  /** Zod schema validating the operation output. */
  output: z.ZodType<O>;
  /** Error codes this operation can surface, all from ERROR_CATALOGUE. */
  errors: readonly PublicErrorCode[];
  /** HTTP mapping; omit for non-HTTP (e.g. internal or MCP-only) operations. */
  http?: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string };
  /**
   * MCP tool metadata. Operations with this field appear as MCP tools.
   * Owner-only operations must never carry it — they are never exposed as tools.
   */
  mcp?: { readOnly: boolean; destructive: boolean; idempotent: boolean };
  /** Execute the operation. Context carries what the transport already resolved. */
  execute(context: OperationContext, input: I): Promise<O>;
}
