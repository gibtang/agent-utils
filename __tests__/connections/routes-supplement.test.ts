import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Connections routes + redeem rate limiting (foundation Task 5 supplements).
 * Firebase verification is faked (same pattern as owner/sync-route.test.ts);
 * the database is a real in-memory Mongo so pairing behavior is real.
 *
 * Pair route has no auth by design; owner routes resolve via requireOwner.
 */
vi.mock('@/lib/firebase/verify', () => ({
  verifyFirebaseIdToken: vi.fn(),
  hasTokenVerificationConfig: true,
}));

import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { POST as pair } from '@/app/v1/connections/pair/route';
import { GET as agents, POST as createAgentRoute } from '@/app/api/agents/route';
import { PATCH as renameAgentRoute } from '@/app/api/agents/[agentId]/route';
import { POST as pairingCodeRoute } from '@/app/api/agents/[agentId]/pairing-code/route';
import { DELETE as revokeConnectionRoute } from '@/app/api/connections/[connectionId]/route';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import { createAgent, createPairingCode, redeemPairingCode, revokeConnection } from '@/lib/connections/service';
import { hashSecret } from '@/lib/core/secrets';
import Connection from '@/models/Connection';
import PairingCode from '@/models/PairingCode';

const mockedVerify = vi.mocked(verifyFirebaseIdToken);

function jsonRequest(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

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

describe('connections routes (supplements)', () => {
  it('PATCH /api/agents/[agentId] renames via requireOwner; cross-account stays 404', async () => {
    const account = await provisionAccount({ uid: 'uid-route', email: undefined, displayName: undefined, photoURL: undefined });
    const agent = await createAgent(account, { name: 'Original' });
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-route' });

    const ok = await renameAgentRoute(jsonRequest(`http://localhost/api/agents/${agent.agentId}`, 'PATCH', { name: 'Renamed' }) as never, {
      params: Promise.resolve({ agentId: agent.agentId }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.name).toBe('Renamed');

    const other = await provisionAccount({ uid: 'uid-other', email: undefined, displayName: undefined, photoURL: undefined });
    void other;
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-other' });
    const missing = await renameAgentRoute(jsonRequest(`http://localhost/api/agents/${agent.agentId}`, 'PATCH', { name: 'Hijack' }) as never, {
      params: Promise.resolve({ agentId: agent.agentId }),
    });
    expect(missing.status).toBe(404);
  });

  it('POST /api/agents returns 201 and lists via GET', async () => {
    await provisionAccount({ uid: 'uid-list', email: undefined, displayName: undefined, photoURL: undefined });
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-list' });
    const created = await createAgentRoute(jsonRequest('http://localhost/api/agents', 'POST', { name: 'Listed' }) as never);
    expect(created.status).toBe(201);
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-list' });
    const list = await agents(new Request('http://localhost/api/agents', { headers: { authorization: 'Bearer test-token' } }) as never);
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Listed');
  });

  it('POST pairing-code route returns a one-time au_pair_ code; unknown agent 404s', async () => {
    const account = await provisionAccount({ uid: 'uid-pair', email: undefined, displayName: undefined, photoURL: undefined });
    const agent = await createAgent(account, { name: 'Pairable' });
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-pair' });

    const ok = await pairingCodeRoute(jsonRequest(`http://localhost/api/agents/${agent.agentId}/pairing-code`, 'POST', { runtime: 'node' }) as never, {
      params: Promise.resolve({ agentId: agent.agentId }),
    });
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.data.code).toMatch(/^au_pair_/);
    expect(new Date(body.data.expiresAt).toString()).not.toBe('Invalid Date');
    // exactly one pairing code persisted for that agent, hash-only
    const stored = await PairingCode.find({ agentId: agent.agentId }).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0].codeHash).toBe(hashSecret(body.data.code));
    expect(JSON.stringify(stored)).not.toContain(body.data.code);

    mockedVerify.mockResolvedValueOnce({ uid: 'uid-pair' });
    const unknown = await pairingCodeRoute(jsonRequest('http://localhost/api/agents/agt_missing/pairing-code', 'POST', {}) as never, {
      params: Promise.resolve({ agentId: 'agt_missing' }),
    });
    expect(unknown.status).toBe(404);
  });

  it('DELETE /api/connections/[connectionId] is idempotent for the owning account (documented)', async () => {
    const account = await provisionAccount({ uid: 'uid-revoke', email: undefined, displayName: undefined, photoURL: undefined });
    const agent = await createAgent(account, { name: 'Revocable' });
    const code = await createPairingCode(account, agent.agentId, {});
    const { connection } = await redeemPairingCode({ code: code.code });
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-revoke' });

    const first = await revokeConnectionRoute(new Request(`http://localhost/api/connections/${connection.connectionId}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer test-token' },
    }) as never, { params: Promise.resolve({ connectionId: connection.connectionId }) });
    expect(first.status).toBe(200);
    const stored = await Connection.findOne({ connectionId: connection.connectionId }).lean();
    expect(stored!.status).toBe('revoked');

    // documented: revocation is idempotent for the owning account
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-revoke' });
    const second = await revokeConnectionRoute(new Request(`http://localhost/api/connections/${connection.connectionId}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer test-token' },
    }) as never, { params: Promise.resolve({ connectionId: connection.connectionId }) });
    expect(second.status).toBe(200);
    expect((await Connection.findOne({ connectionId: connection.connectionId }).lean())!.status).toBe('revoked');
  });

  it('blocks the 21st redemption from one IP within the window (redeem per-IP policy)', async () => {
    // 3 accounts so pairing-CREATE limits (10/hour/account) never fire before
    // the redeem per-IP limit (20/15min) is reached. Each redemption is revoked
    // immediately so plan capacity (free = 1 active) never blocks either.
    const accounts = [];
    for (const uid of ['uid-ip1', 'uid-ip2', 'uid-ip3']) {
      const account = await provisionAccount({ uid, email: undefined, displayName: undefined, photoURL: undefined });
      const agent = await createAgent(account, { name: `Flood-${uid}` });
      accounts.push({ account, agent });
    }

    const redeem = async (code: string) =>
      pair(jsonRequest('http://localhost/v1/connections/pair', 'POST', { code }, { 'x-forwarded-for': '203.0.113.9' }));

    let created = 0;
    for (const { account, agent } of accounts.slice(0, 2)) {
      for (let i = 0; i < 10; i++) {
        const { code } = await createPairingCode(account, agent.agentId, {});
        const res = await redeem(code);
        expect(res.status).toBe(201);
        const body = await res.json();
        await revokeConnection(account, body.data.connection.connectionId);
        created += 1;
      }
    }
    expect(created).toBe(20);

    const { code: code21 } = await createPairingCode(accounts[2].account, accounts[2].agent.agentId, {});
    const blocked = await redeem(code21);
    expect(blocked.status).toBe(429);
    const errBody = await blocked.json();
    expect(errBody.error.code).toBe('plan_limit_reached');
    expect(JSON.stringify(errBody)).not.toContain(code21);
  });
});
