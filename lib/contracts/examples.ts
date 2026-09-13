/**
 * Canonical request/response examples per operation.
 *
 * Every example must satisfy the operation's zod schemas — enforced by
 * __tests__/contracts/examples.test.ts — so docs, SDK snippets and fixtures
 * never drift from the contract.
 */
import { z } from 'zod';

type AnyOperation = { name: string } & { input: z.ZodType<unknown>; output: z.ZodType<unknown> };

const connectionViewExample = {
  connectionId: 'conn_01EXAMPLE0000000000CONN',
  agentId: 'agt_01EXAMPLE0000000000AGENT',
  accountId: 'acct_01EXAMPLE000000000ACCT',
  status: 'active',
  runtime: 'node',
  displayPrefix: 'au_conn_XyZ',
  createdAt: '2026-01-01T00:00:00.000Z',
} as const;

const agentViewExample = {
  agentId: 'agt_01EXAMPLE0000000000AGENT',
  accountId: 'acct_01EXAMPLE000000000ACCT',
  name: 'My Agent',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
} as const;

const statusViewExample = {
  agentName: 'My Agent',
  connection: connectionViewExample,
  plan: 'free',
  capabilities: ['inbox', 'state', 'files'],
} as const;

/** Example request bodies keyed by operation name. */
export const REQUEST_EXAMPLES: Record<string, unknown> = {
  pair_connection: { code: 'au_pair_1A2B3C4D5E6F7H8J9K0M', runtimeVersion: 'node-22.11.0' },
  connection_status: {},
  create_agent: { name: 'My Agent' },
  rename_agent: { agentId: agentViewExample.agentId, name: 'Renamed Agent' },
};

/** Example response bodies keyed by operation name. */
export const RESPONSE_EXAMPLES: Record<string, unknown> = {
  pair_connection: { connection: connectionViewExample, credential: 'au_conn_1A2B3C4D5E6F7H8J9K0M' },
  connection_status: statusViewExample,
  create_agent: agentViewExample,
  rename_agent: agentViewExample,
};

/** Typed accessor: the example for an operation's request body. */
export function requestExampleFor(op: AnyOperation): unknown {
  return REQUEST_EXAMPLES[op.name];
}

/** Typed accessor: the example for an operation's response body. */
export function responseExampleFor(op: AnyOperation): unknown {
  return RESPONSE_EXAMPLES[op.name];
}
