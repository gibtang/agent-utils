import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Foundation integration journey (Task 8).
 *
 * The full owner story over REAL routes with REAL services — only the
 * Firebase verifier is faked. Every step asserts the envelope contract:
 * success {data, request_id} / failure {error: {code, ...}}.
 */
vi.mock('@/lib/firebase/verify', () => ({
  verifyFirebaseIdToken: vi.fn(),
  hasTokenVerificationConfig: true,
}));

import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { POST as syncRoute } from '@/app/api/auth/sync/route';
import { POST as createAgentRoute } from '@/app/api/agents/route';
import { PATCH as renameAgentRoute } from '@/app/api/agents/[agentId]/route';
import { POST as pairingCodeRoute } from '@/app/api/agents/[agentId]/pairing-code/route';
import { DELETE as revokeRoute } from '@/app/api/connections/[connectionId]/route';
import { POST as pairRoute } from '@/app/v1/connections/pair/route';
import { GET as statusRoute } from '@/app/v1/connections/status/route';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';

const mockedVerify = vi.mocked(verifyFirebaseIdToken);

function ownerRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer journey-token' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never;
}

type Json = { data?: Record<string, unknown>; error?: { code: string }; request_id?: string };
async function body(response: Response): Promise<Json> {
  return (await response.json()) as Json;
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

describe('foundation journey: provision to revoke', () => {
  it('runs the full owner + agent story over real routes', async () => {
    // 1. First login provisions the account.
    mockedVerify.mockResolvedValueOnce({ uid: 'journey-1', email: 'journey@example.com' });
    const sync = await syncRoute(ownerRequest('http://localhost/api/auth/sync', 'POST'));
    expect(sync.status).toBe(200);
    const syncBody = await body(sync);
    expect(syncBody.request_id).toMatch(/^req_/);
    expect(syncBody.data?.account).toMatchObject({ plan: 'free', status: 'active' });
    expect(syncBody.data?.onboarding).toMatchObject({ hasAgent: false });
    expect(JSON.stringify(syncBody)).not.toContain('new_key');

    // 2. Create an agent.
    mockedVerify.mockResolvedValueOnce({ uid: 'journey-1' });
    const created = await createAgentRoute(ownerRequest('http://localhost/api/agents', 'POST', { name: 'Journey Agent' }));
    expect(created.status).toBe(201);
    const createdBody = await body(created);
    expect(createdBody.request_id).toMatch(/^req_/);
    const agentId = createdBody.data?.agentId as string;
    expect(agentId).toMatch(/^agt_/);

    // 3. Rename it (owner path stays coherent).
    mockedVerify.mockResolvedValueOnce({ uid: 'journey-1' });
    const renamed = await renameAgentRoute(ownerRequest(`http://localhost/api/agents/${agentId}`, 'PATCH', { name: 'Journey Renamed' }), {
      params: Promise.resolve({ agentId }),
    });
    expect(renamed.status).toBe(200);
    expect((await body(renamed)).data?.name).toBe('Journey Renamed');

    // 4. Issue a pairing code.
    mockedVerify.mockResolvedValueOnce({ uid: 'journey-1' });
    const codeResponse = await pairingCodeRoute(ownerRequest(`http://localhost/api/agents/${agentId}/pairing-code`, 'POST', { runtime: 'node' }), {
      params: Promise.resolve({ agentId }),
    });
    expect(codeResponse.status).toBe(201);
    const codeBody = await body(codeResponse);
    const pairingCode = codeBody.data?.code as string;
    expect(pairingCode).toMatch(/^au_pair_/);
    expect(typeof codeBody.data?.expiresAt).toBe('string');

    // 5. The agent runtime redeems it — credential shown exactly once.
    const paired = await pairRoute(new Request('http://localhost/v1/connections/pair', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.7' },
      body: JSON.stringify({ code: pairingCode, runtimeVersion: '1.0' }),
    }));
    expect(paired.status).toBe(201);
    const pairedBody = await body(paired);
    const credential = pairedBody.data?.credential as string;
    const connectionId = (pairedBody.data?.connection as { connectionId: string }).connectionId;
    expect(credential).toMatch(/^au_conn_/);
    expect(connectionId).toMatch(/^conn_/);

    // 6. Replay the same code fails with the catalogue error.
    const replay = await pairRoute(new Request('http://localhost/v1/connections/pair', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.7' },
      body: JSON.stringify({ code: pairingCode }),
    }));
    expect(replay.status).toBe(404);
    expect((await body(replay)).error?.code).toBe('not_found');

    // 7. Status works with the credential and leaks nothing.
    const status = await statusRoute(new Request('http://localhost/v1/connections/status', {
      headers: { authorization: `Bearer ${credential}` },
    }) as never);
    expect(status.status).toBe(200);
    const statusBody = await body(status);
    expect(statusBody.request_id).toMatch(/^req_/);
    expect(statusBody.data?.plan).toBe('free');
    expect(statusBody.data?.agentName).toBe('Journey Renamed');
    expect(statusBody.data?.capabilities).toContain('inbox');
    expect(JSON.stringify(statusBody)).not.toContain(credential);
    expect(JSON.stringify(statusBody)).not.toContain('credentialHash');

    // 8. Owner revokes the connection.
    mockedVerify.mockResolvedValueOnce({ uid: 'journey-1' });
    const revoked = await revokeRoute(new Request(`http://localhost/api/connections/${connectionId}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer journey-token' },
    }) as never, { params: Promise.resolve({ connectionId }) });
    expect(revoked.status).toBe(200);
    expect((await body(revoked)).request_id).toMatch(/^req_/);

    // 9. Status now fails with connection_revoked.
    const after = await statusRoute(new Request('http://localhost/v1/connections/status', {
      headers: { authorization: `Bearer ${credential}` },
    }) as never);
    expect(after.status).toBe(403);
    expect((await body(after)).error?.code).toBe('connection_revoked');
  });
});
