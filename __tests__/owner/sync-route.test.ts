import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * /api/auth/sync — new foundation contract. Firebase verification is faked;
 * the database is a real in-memory Mongo so provisioning behavior is real.
 *
 * Contract under test:
 *   success → { data: { account: {accountId, plan, status},
 *                       profile: {displayName, photoUrl, email},
 *                       onboarding: {hasAgent: boolean, isNewAccount: boolean} }, request_id }
 *   no plaintext credentials, no tenant_id, no new_key — ever.
 */
vi.mock('@/lib/firebase/verify', () => ({
  verifyFirebaseIdToken: vi.fn(),
  hasTokenVerificationConfig: true,
}));

import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { POST } from '@/app/api/auth/sync/route';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import Account from '@/models/Account';
import Agent from '@/models/Agent';

const mockedVerify = vi.mocked(verifyFirebaseIdToken);

function syncRequest(token: string | null) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request('http://localhost/api/auth/sync', { method: 'POST', headers });
}

let server: MongoMemoryServer;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
  await connectDB();
  await Promise.all([Account.createIndexes(), Agent.createIndexes()]);
});

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all([Account.deleteMany({}), Agent.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('POST /api/auth/sync', () => {
  it('rejects a missing bearer header with authentication_required', async () => {
    const res = await POST(syncRequest(null));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('authentication_required');
    expect(typeof body.error.request_id).toBe('string');
  });

  it('rejects an invalid token with authentication_required', async () => {
    mockedVerify.mockResolvedValueOnce(null);
    const res = await POST(syncRequest('bad-token'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('authentication_required');
  });

  it('provisions an account on first sync and returns account/profile/onboarding only', async () => {
    mockedVerify.mockResolvedValueOnce({
      uid: 'uid-new-owner',
      email: 'owner@example.com',
      name: 'New Owner',
      picture: 'https://example.com/p.png',
    });

    const res = await POST(syncRequest('fresh-token'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.account).toMatchObject({ plan: 'free', status: 'active' });
    expect(body.data.account.accountId).toMatch(/^acct_/);
    expect(body.data.profile).toEqual({
      displayName: 'New Owner',
      photoUrl: 'https://example.com/p.png',
      email: 'owner@example.com',
    });
    expect(body.data.onboarding).toEqual({ hasAgent: false, isNewAccount: true });
    expect(typeof body.request_id).toBe('string');

    // Exactly one Account row, owned by the verified uid.
    const rows = await Account.find({ ownerUid: 'uid-new-owner' }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].accountId).toBe(body.data.account.accountId);

    // Removed legacy contract surface must not reappear.
    expect(body.data).not.toHaveProperty('tenant_id');
    expect(body.data).not.toHaveProperty('new_key');
    expect(JSON.stringify(body)).not.toContain('api_key');
  });

  it('is idempotent: a second sync returns the same account without duplicates', async () => {
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-repeat', email: 'r@example.com' });
    const first = await POST(syncRequest('token-1'));
    const firstBody = await first.json();

    mockedVerify.mockResolvedValueOnce({ uid: 'uid-repeat', email: 'r@example.com' });
    const second = await POST(syncRequest('token-2'));
    const secondBody = await second.json();

    expect(secondBody.data.account.accountId).toBe(firstBody.data.account.accountId);
    expect(await Account.countDocuments({ ownerUid: 'uid-repeat' })).toBe(1);
  });

  it('reports onboarding.hasAgent=true once the account has an Agent', async () => {
    const account = await provisionAccount({ uid: 'uid-with-agent', email: null, displayName: null, photoURL: null });
    await Agent.create({ accountId: account.accountId, name: 'Scout' });

    mockedVerify.mockResolvedValueOnce({ uid: 'uid-with-agent' });
    const res = await POST(syncRequest('agent-owner-token'));
    const body = await res.json();
    expect(body.data.onboarding).toEqual({ hasAgent: true, isNewAccount: false });
  });

  it('scoping: another owner\'s agents never leak into onboarding', async () => {
    const mine = await provisionAccount({ uid: 'uid-mine', email: null, displayName: null, photoURL: null });
    const theirs = await provisionAccount({ uid: 'uid-theirs', email: null, displayName: null, photoURL: null });
    await Agent.create({ accountId: theirs.accountId, name: 'Not Mine' });

    mockedVerify.mockResolvedValueOnce({ uid: 'uid-mine' });
    const res = await POST(syncRequest('mine-token'));
    const body = await res.json();
    expect(body.data.onboarding).toEqual({ hasAgent: false, isNewAccount: false });
    expect(mine.accountId).not.toBe(theirs.accountId);
  });
});
