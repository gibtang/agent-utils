/**
 * OpenAPI 3.1 generation from the operation registry.
 *
 * Uses zod v4's native z.toJSONSchema() — no third-party converter. Schemas
 * are inlined per operation, which keeps the document self-contained and the
 * output deterministic (stable registration order, sorted response codes).
 */
import { z } from 'zod';
import { ERROR_CATALOGUE } from '@/lib/core/errors';
import { getServerConfig } from '@/lib/core/config';
import { listOperations } from '@/lib/contracts/registry';
import type { OperationDefinition } from '@/lib/contracts/operation';

type AnyOperation = OperationDefinition<unknown, unknown>;

const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

/** Error response body schema covering the given catalogue codes. */
function errorResponseSchema(codes: (keyof typeof ERROR_CATALOGUE)[]) {
  return z.object({
    error: z.object({
      code: z.enum(codes as [string, ...string[]]),
      message: z.string(),
      data_preserved: z.boolean(),
      retry_safe: z.boolean(),
      next_action: z.string(),
      request_id: z.string(),
    }),
  });
}

/** Deterministic response map: 200 plus every error status the op declares. */
function buildResponses(op: AnyOperation): Record<string, unknown> {
  const responses: Record<string, unknown> = {
    '200': {
      description: 'Successful response.',
      content: { 'application/json': { schema: z.toJSONSchema(op.output, { io: 'output' }) } },
    },
  };
  const statuses = [...new Set(op.errors.map((code) => ERROR_CATALOGUE[code].http))].sort((a, b) => a - b);
  for (const status of statuses) {
    const codes = op.errors.filter((code) => ERROR_CATALOGUE[code].http === status);
    const schema = errorResponseSchema(codes);
    const description = codes
      .map((code) => `${code}: ${ERROR_CATALOGUE[code].message}`)
      .join(' / ');
    responses[String(status)] = {
      description,
      content: { 'application/json': { schema: z.toJSONSchema(schema, { io: 'output' }) } },
    };
  }
  return responses;
}

function buildPathItem(op: AnyOperation): Record<string, unknown> {
  const method = op.http!.method.toLowerCase();
  const operationObject: Record<string, unknown> = {
    operationId: op.name,
    summary: op.summary,
    description: op.description,
    responses: buildResponses(op),
  };
  if (op.mcp) {
    operationObject['x-mcp'] = { readOnly: op.mcp.readOnly, destructive: op.mcp.destructive, idempotent: op.mcp.idempotent };
  }
  if (method === 'get' || method === 'delete') {
    operationObject['parameters'] = [];
  } else {
    operationObject['requestBody'] = {
      required: true,
      content: { 'application/json': { schema: z.toJSONSchema(op.input, { io: 'input' }) } },
    };
    operationObject['parameters'] = [];
  }
  return { [method]: operationObject };
}

/** Build a complete OpenAPI 3.1 document from the registered operations. */
export function toOpenAPISpec(operations = listOperations()): Record<string, unknown> {
  const { appUrl } = getServerConfig();
  const paths: Record<string, unknown> = {};
  for (const op of operations) {
    if (!op.http) continue;
    paths[op.http.path] = { ...buildPathItem(op), ...(paths[op.http.path] ?? {}) };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'AgentUtils API',
      version: '0.1.0',
      description: 'Agent-facing and owner-facing HTTP API. One registry drives this document, llms.txt and the MCP tool surface.',
    },
    servers: [{ url: appUrl }],
    'jsonSchemaDialect': JSON_SCHEMA_DIALECT,
    paths,
  };
}
