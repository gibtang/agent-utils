import { describe, expect, it } from 'vitest';
import { REQUEST_EXAMPLES, RESPONSE_EXAMPLES } from '@/lib/contracts/examples';
import '@/lib/connections/operations';
import { listOperations } from '@/lib/contracts/registry';

const operationNames = listOperations().map((op) => op.name);

describe('contract examples', () => {
  it('provides request and response examples for every registered operation', () => {
    for (const name of operationNames) {
      expect(REQUEST_EXAMPLES[name], `request example for ${name}`).toBeDefined();
      expect(RESPONSE_EXAMPLES[name], `response example for ${name}`).toBeDefined();
    }
  });

  it('every request example validates against its operation input schema', () => {
    for (const op of listOperations()) {
      const parsed = op.input.safeParse(REQUEST_EXAMPLES[op.name]);
      if (!parsed.success) {
        throw new Error(`request example for ${op.name} fails schema: ${JSON.stringify(parsed.error.issues)}`);
      }
      expect(parsed.success).toBe(true);
    }
  });

  it('every response example validates against its operation output schema', () => {
    for (const op of listOperations()) {
      const parsed = op.output.safeParse(RESPONSE_EXAMPLES[op.name]);
      if (!parsed.success) {
        throw new Error(`response example for ${op.name} fails schema: ${JSON.stringify(parsed.error.issues)}`);
      }
      expect(parsed.success).toBe(true);
    }
  });

  it('examples use realistic shapes matching the documented views', () => {
    const pairResponse = RESPONSE_EXAMPLES.pair_connection as { credential: string; connection: { connectionId: string } };
    expect(pairResponse.credential).toMatch(/^au_conn_/);
    expect(pairResponse.connection.connectionId).toMatch(/^conn_/);
    const statusResponse = RESPONSE_EXAMPLES.connection_status as { connection: { connectionId: string } };
    expect(statusResponse.connection.connectionId).toMatch(/^conn_/);
  });
});
