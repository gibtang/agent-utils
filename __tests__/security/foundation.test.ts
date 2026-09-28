import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Foundation security gate (Task 8).
 *
 * Cross-account isolation: owner-A identities can never touch owner-B
 * resources. Credential hygiene: au_conn_/au_pair_ plaintexts and their
 * hashes appear only at their single documented issuance moments — never
 * in listings, status responses, or MCP tool I/O.
 */
vi.mock('@/lib/firebase/verify', () => ({
  verifyFirebaseIdToken: vi.fn(),
  hasTokenVerificationConfig: true,
}));

import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { buildMcpServer } from '@/lib/mcp/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
// Importing operations populates the shared registry (buildMcpServer reads it).
import '@/lib/connections/operations';
import { GET as agentsRoute } from '@/app/api/agents/route';
import { GET as statusRoute } from '@/app/v1/connections/status/route';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import {
  authenticateConnection,
  createAgent,
  createPairingCode,
  redeemPairingCode,
  renameAgent,
  revokeConnection,
} from '@/lib/connections/service';
import { hashSecret } from '@/lib/core/secrets';
import type { ConnectionActor } from '@/lib/connections/service';

const mockedVerify = vi.mocked(verifyFirebaseIdToken);

let server: MongoMemoryServer;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
  await connectDB();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({});
  vi.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('owner isolation matrix', () => {
  it('owner A cannot rename, pair, or revoke owner B resources', async () => {
    const a = await provisionAccount({ uid: 'iso-a', email: undefined, displayName: undefined, photoURL: undefined });
    const b = await provisionAccount({ uid: 'iso-b', email: undefined, displayName: undefined, photoURL: undefined });
    const agentB = await createAgent(b, { name: 'B Agent' });
    const codeB = await createPairingCode(b, agentB.agentId, {});
    const { connection: connectionB, credential: credentialB } = await redeemPairingCode({ code: codeB.code });
    void connectionB;

    await expect(renameAgent(a, agentB.agentId, { name: 'Hijacked' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(createPairingCode(a, agentB.agentId, {})).rejects.toMatchObject({ code: 'not_found' });
    await expect(revokeConnection(a, connectionB.connectionId)).rejects.toMatchObject({ code: 'not_found' });

    // B's credential still works — A's probes changed nothing.
    const actorB = await authenticateConnection(credentialB);
    expect(actorB.accountId).toBe(b.accountId);
  });

  it('agents list route shows only the calling owner agents', async () => {
    const a = await provisionAccount({ uid: 'iso-list-a', email: undefined, displayName: undefined, photoURL: undefined });
    const b = await provisionAccount({ uid: 'iso-list-b', email: undefined, displayName: undefined, photoURL: undefined });
    await createAgent(a, { name: 'A Only' });
    await createAgent(b, { name: 'B Only' });

    mockedVerify.mockResolvedValueOnce({ uid: 'iso-list-a' });
    const response = await agentsRoute(new Request('http://localhost/api/agents', { headers: { authorization: 'Bearer t' } }) as never);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ name: string }> };
    expect(body.data.map((agent) => agent.name)).toEqual(['A Only']);
  });
});

describe('credential hygiene sweep', () => {
  it('full lifecycle leaks secrets only at their single issuance moments', async () => {
    const account = await provisionAccount({ uid: 'hyg-1', email: undefined, displayName: undefined, photoURL: undefined });
    const agent = await createAgent(account, { name: 'Hygiene' });

    const pairView = await createPairingCode(account, agent.agentId, {});
    const pairingCode = pairView.code;
    const codeHash = hashSecret(pairingCode);

    const { connection, credential } = await redeemPairingCode({ code: pairingCode });
    const credentialHash = hashSecret(credential);

    // Issuance moments are the ONLY places the plaintexts may appear.
    expect(credential).toMatch(/^au_conn_/);
    expect(connection.displayPrefix.length).toBeLessThanOrEqual(12);

    const actor = await authenticateConnection(credential);
    void actor;

    await revokeConnection(account, connection.connectionId);

    // Hashes never surface in any service-level view.
    const artifacts = JSON.stringify({ connection, actor, pairViewless: { expiresAt: pairView.expiresAt } });
    expect(artifacts).not.toContain(credential);
    expect(artifacts).not.toContain(pairingCode);
    expect(artifacts).not.toContain(credentialHash);
    expect(artifacts).not.toContain(codeHash);
    expect(artifacts).not.toContain('credentialHash');
    expect(artifacts).not.toContain('codeHash');

    // MCP tools/list and tools/call responses are clean too.
    const mcpActor = { connectionId: connection.connectionId, agentId: connection.agentId, accountId: connection.accountId, plan: account.plan } as ConnectionActor;
    const mcpServer = buildMcpServer(mcpActor);
    const client = new Client({ name: 'hygiene-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([mcpServer.connect(serverTransport), client.connect(clientTransport)]);
    const listed = await client.listTools();
    const listedText = JSON.stringify(listed);
    expect(listedText).not.toContain(credential);
    expect(listedText).not.toContain(pairingCode);
    expect(listedText).not.toContain('credentialHash');
    const called = await client.callTool({ name: 'connection_status', arguments: {} });
    const calledText = JSON.stringify(called);
    expect(calledText).not.toContain(credential);
    expect(calledText).not.toContain('credentialHash');
    await client.close();
  });

  it('status route response never contains hashes or secrets', async () => {
    const account = await provisionAccount({ uid: 'hyg-2', email: undefined, displayName: undefined, photoURL: undefined });
    const agent = await createAgent(account, { name: 'Status Leak' });
    const code = await createPairingCode(account, agent.agentId, {});
    const { credential } = await redeemPairingCode({ code: code.code });

    const response = await statusRoute(new Request('http://localhost/v1/connections/status', {
      headers: { authorization: `Bearer ${credential}` },
    }) as never);
    expect(response.status).toBe(200);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('credentialHash');
    expect(text).not.toContain('codeHash');
    expect(text).not.toContain(credential);
    expect(text).not.toContain(code.code);
  });
});
