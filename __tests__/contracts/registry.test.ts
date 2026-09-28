import { beforeAll, describe, expect, it } from 'vitest';
import { ERROR_CATALOGUE } from '@/lib/core/errors';
// Importing the operations module registers the connection operations as a side effect.
import '@/lib/connections/operations';
import { clearRegistryForTests, getOperation, listOperations, registerOperation } from '@/lib/contracts/registry';

// The registry is populated by module side effects (import order). To test
// registration validation without permanently polluting the shared registry,
// snapshot the real registrations before clearing, run the tests against the
// clean registry, and restore them afterwards.
let savedOperations: ReturnType<typeof listOperations>;

const baseDef = {
  name: 'test_op',
  summary: 'A test operation.',
  description: 'Longer description for the test operation.',
  actor: 'public' as const,
  input: { safeParse: () => ({ success: true, data: {} }) },
  output: { safeParse: () => ({ success: true, data: {} }) },
  errors: ['validation_failed'] as const,
  http: { method: 'POST' as const, path: '/v1/test' },
};

function registerTestOp(overrides: Record<string, unknown> = {}): void {
  registerOperation({ ...baseDef, ...overrides } as never);
}

/** Run `fn` with a clean registry; restore the snapshot afterwards no matter what. */
function withCleanRegistry(fn: () => void): void {
  clearRegistryForTests();
  try {
    fn();
  } finally {
    clearRegistryForTests();
    for (const op of savedOperations) registerOperation(op as never);
  }
}

beforeAll(() => {
  savedOperations = listOperations();
});

describe('contracts registry', () => {
  it('rejects duplicate operation names', () =>
    withCleanRegistry(() => {
      registerTestOp();
      expect(() => registerTestOp()).toThrowError(/duplicate operation name/i);
    }));

  it('rejects duplicate http method+path pairs', () =>
    withCleanRegistry(() => {
      registerTestOp();
      expect(() => registerTestOp({ name: 'test_op_2', http: { method: 'POST', path: '/v1/test' } })).toThrowError(
        /duplicate http route/i,
      );
      expect(() => registerTestOp({ name: 'test_op_3', http: { method: 'post', path: '/v1/test' } })).toThrowError(
        /duplicate http route/i,
      );
    }));

  it('rejects owner operations that carry mcp metadata', () =>
    withCleanRegistry(() => {
      expect(() =>
        registerTestOp({
          name: 'owner_op',
          http: undefined,
          actor: 'owner',
          mcp: { readOnly: true, destructive: false, idempotent: true },
        }),
      ).toThrowError(/owner-only operations must not expose mcp tools/i);
    }));

  it('rejects owner operations that map to an http route', () =>
    withCleanRegistry(() => {
      expect(() =>
        registerTestOp({ name: 'owner_op_http', http: { method: 'POST', path: '/v1/owner' }, actor: 'owner' }),
      ).toThrowError(/owner-only operations must not map to an http route/i);
    }));

  it('allows owner operations without mcp metadata', () =>
    withCleanRegistry(() => {
      registerTestOp({ name: 'owner_op_ok', http: undefined, 'actor': 'owner' });
      const op = getOperation('owner_op_ok');
      expect(op).toBeDefined();
      expect(op!.mcp).toBeUndefined();
    }));

  it('rejects unknown error codes', () =>
    withCleanRegistry(() => {
      expect(() => registerTestOp({ name: 'bad_errors_op', errors: ['not_a_real_code' as never] })).toThrowError(
        /unknown error code/i,
      );
    }));

  it('rejects operations with empty summary, description or errors', () =>
    withCleanRegistry(() => {
      expect(() => registerTestOp({ name: 'empty_summary', summary: '' })).toThrowError(/must have a non-empty summary/i);
      expect(() => registerTestOp({ name: 'empty_description', description: '  ' })).toThrowError(
        /must have a non-empty description/i,
      );
      expect(() => registerTestOp({ name: 'empty_errors', errors: [] })).toThrowError(
        /must declare at least one error/i,
      );
    }));

  it('defines every connection operation with summary, description and known errors', () => {
    for (const op of savedOperations) {
      expect(op.summary.length).toBeGreaterThan(0);
      expect(op.description.length).toBeGreaterThan(0);
      expect(op.errors.length).toBeGreaterThan(0);
      for (const code of op.errors) expect(code in ERROR_CATALOGUE).toBe(true);
    }
  });

  it('lists all four connection operations once side effects have run', () => {
    const names = savedOperations.map((o) => o.name);
    expect(names).toEqual(expect.arrayContaining(['pair_connection', 'connection_status', 'create_agent', 'rename_agent']));
    expect(names).toHaveLength(4);
  });

  it('exposes exactly the connection-actor and public operations as mcp tools', () => {
    const mcpNames = savedOperations.filter((o) => o.mcp).map((o) => o.name);
    expect(mcpNames).toEqual(expect.arrayContaining(['pair_connection', 'connection_status']));
    expect(mcpNames).toHaveLength(2);
  });

  it('resolves operations by name', () => {
    const op = getOperation('pair_connection');
    expect(op).toBeDefined();
    expect(op!.actor).toBe('public');
    expect(op!.http).toEqual({ method: 'POST', path: '/v1/connections/pair' });
    expect(getOperation('missing_op')).toBeUndefined();
  });
});
