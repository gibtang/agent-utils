/**
 * Remote MCP endpoint (foundation Task 7).
 *
 * The MCP server is built from the SAME operation registry that feeds the
 * HTTP routes and the generated contracts, with the actor fixed at server
 * construction:
 * - an actor-less server exposes ONLY public operations (pair_connection);
 * - a connection-authenticated server additionally exposes connection ops
 *   (connection_status);
 * - owner-only operations (create_agent, rename_agent) carry no mcp metadata
 *   and therefore NEVER appear as tools on any server.
 *
 * Tool-surface tests run over InMemoryTransport (no HTTP involved). One
 * HTTP-level test exercises app/mcp/route.ts POST in stateless mode with
 * authenticateConnection mocked; the registry itself stays real.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import { createAgent, createPairingCode, redeemPairingCode } from '@/lib/connections/service';
// Importing operations populates the shared registry (pair_connection,
// connection_status, create_agent, rename_agent).
import '@/lib/connections/operations';
import { buildMcpServer } from '@/lib/mcp/server';

let mongoServer: MongoMemoryServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  resetConfigCacheForTests();
  await connectDB();
});
afterEach(async () => {
  await Promise.all([
    mongoose.connection.collections.Account?.deleteMany({}),
    mongoose.connection.collections.Agent?.deleteMany({}),
    mongoose.connection.collections.Connection?.deleteMany({}),
    mongoose.connection.collections.PairingCode?.deleteMany({}),
    mongoose.connection.collections.RateLimitBucket?.deleteMany({}),
  ]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  resetConfigCacheForTests();
});

/** Never-owner actor shapes for the two MCP-visible actor kinds. */
const connectionActor = { connectionId: 'conn_test', agentId: 'agt_test', accountId: 'acct_test', plan: 'free' as const };
type MaybeActor = Parameters<typeof buildMcpServer>[0];

/** Connect a fresh client to a fresh buildMcpServer over an in-memory pair. */
async function connect(actor: MaybeActor): Promise<Client> {
  const server = buildMcpServer(actor);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function toolNames(client: Client): Promise<string[]> {
  const { tools } = await client.listTools();
  return tools.map((tool) => tool.name);
}

function textPayload(result: { content: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  return JSON.parse(result.content[0].text as string) as Record<string, unknown>;
}

describe('mcp tool surface', () => {
  it('exposes only public operations to unauthenticated clients', async () => {
    const client = await connect(undefined);
    expect(await toolNames(client)).toEqual(['pair_connection']);
  });

  it('excludes owner-only operations from every surface', async () => {
    for (const actor of [undefined, connectionActor]) {
      const client = await connect(actor);
      const names = await toolNames(client);
      expect(names).not.toContain('create_agent');
      expect(names).not.toContain('rename_agent');
      await client.close();
    }
  });

  it('adds connection operations for connection-authenticated clients', async () => {
    const client = await connect(connectionActor);
    const names = await toolNames(client);
    expect(names).toContain('pair_connection');
    expect(names).toContain('connection_status');
    expect(names).toHaveLength(6);
  });

  it('describes tools from registry metadata with mcp annotations', async () => {
    const client = await connect(undefined);
    const { tools } = await client.listTools();
    const pair = tools.find((tool) => tool.name === 'pair_connection');
    expect(pair?.description).toContain('Pair a runtime with an agent using a pairing code.');
    expect(pair?.description).toContain('Exchanges a one-time pairing code');
    expect(pair?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: false });
    const status = tools.find((tool) => tool.name === 'connection_status');
    if (status) {
      expect(status.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
    }
  });

  it('executes connection_status with the constructed actor', async () => {
    const account = await provisionAccount({ uid: 'mcp-status', email: undefined, displayName: undefined, photoURL: undefined });
    const agent = await createAgent(account, { name: 'Status Agent' });
    const issued = await createPairingCode(account, agent.agentId, {});
    const { connection } = await redeemPairingCode({ code: issued.code });
    const actor = {
      connectionId: connection.connectionId,
      agentId: connection.agentId,
      accountId: connection.accountId,
      plan: account.plan,
    } as MaybeActor;
    const client = await connect(actor);
    const result = await client.callTool({ name: 'connection_status', arguments: {} });
    expect(result.isError).toBeFalsy();
    const payload = textPayload(result as { content: Array<{ type: string; text: string }> });
    const data = payload.data as { plan: string; agentName: string };
    expect(data.plan).toBe('free');
    expect(data.agentName).toBe('Status Agent');
  });

  it('returns a catalogue-shaped error when an actor-less server runs a connection operation', async () => {
    const client = await connect(undefined);
    const result = await client.callTool({ name: 'connection_status', arguments: {} });
    expect(result.isError).toBe(true);
    const payload = textPayload(result as { content: Array<{ type: string; text: string }> });
    const error = payload.error as { code: string; message: string; data_preserved: boolean; retry_safe: boolean; next_action: string; request_id: string };
    expect(error.code).toBe('authentication_required');
    expect(error.request_id).toMatch(/^req_/);
    expect(typeof error.data_preserved).toBe('boolean');
    expect(typeof error.retry_safe).toBe('boolean');
    expect(typeof error.next_action).toBe('string');
  });

  it('pairs a runtime with a real pairing code through the tool', async () => {
    const account = await provisionAccount({ uid: 'mcp-pair', email: null, displayName: null, photoURL: null });
    const agent = await createAgent(account, { name: 'Mcp Agent' });
    const issued = await createPairingCode(account, agent.agentId, {});
    const client = await connect(undefined);
    const result = await client.callTool({ name: 'pair_connection', arguments: { code: issued.code } });
    expect(result.isError).toBeFalsy();
    const payload = textPayload(result as { content: Array<{ type: string; text: string }> });
    const data = payload.data as { credential: string; connection: { connectionId: string; createdAt: string } };
    expect(data.credential).toMatch(/^au_conn_/);
    expect(data.connection.connectionId).toMatch(/^conn_/);
    expect(data.connection.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects invalid tool arguments via SDK-owned validation before the operation runs', async () => {
    const client = await connect(undefined);
    const result = await client.callTool({ name: 'pair_connection', arguments: { code: '' } });
    // SDK 1.30 validates inputSchema inside registerTool: schema violations
    // surface as protocol-level InvalidParams (plain-text isError result) and
    // NEVER reach op.execute — so the catalogue body cannot appear here.
    // Domain-level validation_failed is exercised by the HTTP/envelope tests.
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ type: string }>)[0].type).toBe('text');
  });

  it('maps unexpected failures to temporarily_unavailable', async () => {
    // Force a NON-DomainError throw: spy on the service binding the operation
    // adapter calls (the module namespace is the vi.mock factory object, so
    // the spy is visible to operations.ts).
    const service = await import('@/lib/connections/service');
    const spy = vi.spyOn(service, 'getConnectionStatus').mockRejectedValueOnce(new Error('boom'));
    try {
      const client = await connect(connectionActor);
      const result = await client.callTool({ name: 'connection_status', arguments: {} });
      expect(result.isError).toBe(true);
      const payload = textPayload(result as { content: Array<{ type: string; text: string }> });
      expect((payload.error as { code: string }).code).toBe('temporarily_unavailable');
      expect((payload.error as { request_id: string }).request_id).toMatch(/^req_/);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// HTTP-level: app/mcp/route.ts in stateless mode
// ---------------------------------------------------------------------------

const routeAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/connections/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/connections/service')>();
  return { ...actual, authenticateConnection: routeAuth };
});

describe('mcp http route (stateless streamable http)', () => {
  it('serves an unauthenticated streamable-http session listing only public tools', async () => {
    const { POST, DELETE } = await import('@/app/mcp/route');
    const url = 'http://localhost/mcp';
    const base = {
      'accept': 'application/json, text/event-stream',
      'content-type': 'application/json',
    };

    const initialize = await POST(
      new Request(url, {
        method: 'POST',
        headers: base,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'vitest-client', version: '0.0.0' },
          },
        }),
      }),
    );
    expect(initialize.status).toBe(200);
    const initBody = (await initialize.json()) as { result: { protocolVersion: string } };
    expect(initBody.result.protocolVersion).toBe('2025-03-26');

    const listed = await POST(
      new Request(url, {
        method: 'POST',
        headers: base,
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      }),
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { result: { tools: Array<{ name: string }> } };
    const names = listBody.result.tools.map((tool) => tool.name);
    expect(names).toContain('pair_connection');
    expect(names).not.toContain('create_agent');
    expect(names).not.toContain('rename_agent');

    const ended = await DELETE(new Request(url, { method: 'DELETE' }));
    expect(ended.status).toBeLessThan(500);
  });

  it('authenticates bearer connection credentials before building the server', async () => {
    // stateless mode: the server (and its actor) is rebuilt for EVERY POST,
    // so both requests in this test must see the authenticated actor.
    routeAuth.mockResolvedValueOnce(connectionActor);
    routeAuth.mockResolvedValueOnce(connectionActor);
    const { POST } = await import('@/app/mcp/route');
    const url = 'http://localhost/mcp';
    const headers = {
      'accept': 'application/json, text/event-stream',
      'content-type': 'application/json',
      'authorization': 'Bearer au_conn_live',
    };

    const initialize = await POST(
      new Request(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'vitest-client', version: '0.0.0' } },
        }),
      }),
    );
    expect(initialize.status).toBe(200);
    expect(routeAuth).toHaveBeenCalledWith('au_conn_live');

    const listed = await POST(
      new Request(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      }),
    );
    const listBody = (await listed.json()) as { result: { tools: Array<{ name: string }> } };
    const names = listBody.result.tools.map((tool) => tool.name);
    expect(names).toContain('pair_connection');
    expect(names).toContain('connection_status');
    expect(names).not.toContain('create_agent');
  });

  it('falls back to an actor-less server when the credential is invalid', async () => {
    routeAuth.mockRejectedValueOnce(new Error('authentication failed'));
    const { POST } = await import('@/app/mcp/route');
    const response = await POST(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/event-stream',
          'content-type': 'application/json',
          'authorization': 'Bearer au_conn_dead',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'vitest-client', version: '0.0.0' } },
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: Record<string, unknown> };
    expect(body.result).toBeTruthy();
    expect(routeAuth).toHaveBeenCalledWith('au_conn_dead');
  });
});
