import { ERROR_CATALOGUE } from '@/lib/contracts/errors';
import type { OperationDefinition } from '@/lib/contracts/operation';

type AnyOperation = OperationDefinition<unknown, unknown>;

/**
 * Central operation registry. Operations are registered once (module side
 * effect) and looked up by name, actor, HTTP route, or MCP exposure.
 *
 * Invariants enforced at registration time:
 * - unique operation name,
 * - unique HTTP method+path (case-insensitive method),
 * - unknown error codes rejected (code and docs must stay in sync),
 * - owner-only operations never carry MCP metadata (owner-only operations
 *   never appear as MCP tools).
 */
const byName = new Map<string, AnyOperation>();
const httpRoutes = new Map<string, string>();

function routeKey(route: { method: string; path: string }): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

export function registerOperation<I, O>(definition: OperationDefinition<I, O>): void {
  if (byName.has(definition.name)) {
    throw new Error(`Operation registry: duplicate operation name "${definition.name}".`);
  }
  if (definition.http) {
    const key = routeKey(definition.http);
    const existing = httpRoutes.get(key);
    if (existing) {
      throw new Error(`Operation registry: duplicate http route ${key} (already registered by "${existing}").`);
    }
  }
  for (const code of definition.errors) {
    if (!(code in ERROR_CATALOGUE)) {
      throw new Error(`Operation registry: "${definition.name}" references unknown error code "${String(code)}".`);
    }
  }
  if (definition.actor === 'owner' && definition.mcp) {
    throw new Error(`Operation registry: owner-only operations must not expose mcp tools ("${definition.name}").`);
  }
  if (definition.actor === 'owner' && definition.http) {
    throw new Error(`Operation registry: owner-only operations must not map to an http route ("${definition.name}").`);
  }
  if (!definition.summary.trim()) {
    throw new Error(`Operation registry: "${definition.name}" must have a non-empty summary.`);
  }
  if (!definition.description.trim()) {
    throw new Error(`Operation registry: "${definition.name}" must have a non-empty description.`);
  }
  if (definition.errors.length === 0) {
    throw new Error(`Operation registry: "${definition.name}" must declare at least one error code.`);
  }
  byName.set(definition.name, definition as unknown as AnyOperation);
  if (definition.http) httpRoutes.set(routeKey(definition.http), definition.name);
}

export function getOperation(name: string): AnyOperation | undefined {
  return byName.get(name);
}

export function listOperations(): AnyOperation[] {
  return [...byName.values()];
}

/** Operations exposed as MCP tools (those carrying mcp metadata). */
export function listMcpOperations(): AnyOperation[] {
  return listOperations().filter((op) => op.mcp);
}

/** Operations with an HTTP mapping, for OpenAPI generation. */
export function listHttpOperations(): AnyOperation[] {
  return listOperations().filter((op) => op.http);
}

/** Test-only: reset the registry so individual tests start from a clean slate. */
export function clearRegistryForTests(): void {
  byName.clear();
  httpRoutes.clear();
}
