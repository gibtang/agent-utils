import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { NextRequest } from 'next/server';

/**
 * requireOwner tests. The Firebase verifier is faked via vi.mock — no real
 * JWT/JWKS work happens here. requireOwner's job is: bearer extraction,
 * delegation to lib/firebase/verify.ts, ownerUid → Account resolution (uid
 * only — there is no account-id parameter accepting ownership), and uniform
 * Errors.authenticationRequired failures.
 */
vi.mock('@/lib/firebase/verify', () => ({
  verifyFirebaseIdToken: vi.fn(),
  hasTokenVerificationConfig: true,
}));

import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { requireOwner, bearerHeaders, extractBearerToken } from '@/lib/owner/auth';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import { Errors } from '@/lib/core/errors';
import Account from '@/models/Account';

const mockedVerify = vi.mocked(verifyFirebaseIdToken);

function makeRequest(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

let server: MongoMemoryServer;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
  await connectDB();
  await Account.createIndexes();
});

afterEach(async () => {
  vi.clearAllMocks();
  await Account.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('requireOwner', () => {
  it('resolves a valid token to { accountId, ownerUid }', async () => {
    await provisionAccount({ uid: 'uid-alice', email: 'a@example.com', displayName: 'Alice', photoURL: null });
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-alice', email: 'a@example.com' });

    const result = await requireOwner(makeRequest(bearerHeaders('good-token')));
    expect(result).toMatchObject({ accountId: expect.stringMatching(/^acct_/), ownerUid: 'uid-alice' });
  });

  it('resolves owner A to account A, never account B (uid-only lookup)', async () => {
    const a = await provisionAccount({ uid: 'uid-alice', email: null, displayName: null, photoURL: null });
    await provisionAccount({ uid: 'uid-bob', email: null, displayName: null, photoURL: null });

    mockedVerify.mockResolvedValueOnce({ uid: 'uid-alice' });
    const alice = await requireOwner(makeRequest(bearerHeaders('alice-token')));
    expect(alice.accountId).toBe(a.accountId);
    expect(alice.ownerUid).toBe('uid-alice');

    // Same helper, Bob's own account: the lookup key is exclusively the
    // verified uid from the token.
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-bob' });
    const bob = await requireOwner(makeRequest(bearerHeaders('bob-token')));
    expect(bob.accountId).not.toBe(a.accountId);
  });

  it('never accepts an account id from the request — spoofed ids are ignored', async () => {
    const a = await provisionAccount({ uid: 'uid-alice', email: null, displayName: null, photoURL: null });
    const b = await provisionAccount({ uid: 'uid-bob', email: null, displayName: null, photoURL: null });

    // "Bob" presents Alice's account id in any header; verification still
    // resolves Bob's uid, so Bob still gets Bob's account — never Alice's.
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-bob' });
    const result = await requireOwner(
      makeRequest({ ...bearerHeaders('bob-token'), 'x-account-id': a.accountId }),
    );
    expect(result.accountId).toBe(b.accountId);
    expect(result.accountId).not.toBe(a.accountId);
  });

  it('throws authentication_required when the Authorization header is missing', async () => {
    await expect(requireOwner(makeRequest({}))).rejects.toMatchObject({
      name: 'DomainError',
      code: 'authentication_required',
      http: 401,
    });
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('throws authentication_required for a malformed header (no Bearer scheme)', async () => {
    await expect(
      requireOwner(makeRequest({ authorization: 'Basic dXNlcjpwYXNz' })),
    ).rejects.toMatchObject({ code: 'authentication_required' });
    await expect(
      requireOwner(makeRequest({ authorization: 'Bearer    ' })),
    ).rejects.toMatchObject({ code: 'authentication_required' });
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('throws authentication_required when token verification fails', async () => {
    mockedVerify.mockResolvedValueOnce(null);
    await expect(
      requireOwner(makeRequest(bearerHeaders('forged-token'))),
    ).rejects.toMatchObject({ code: 'authentication_required' });
    expect(mockedVerify).toHaveBeenCalledWith('forged-token');
  });

  it('throws authentication_required when the verified uid has no Account', async () => {
    // Documented behavior: provisioning happens exclusively in /api/auth/sync.
    // requireOwner is authorization for already-provisioned owners, so a valid
    // token for an unknown uid is still authentication_required.
    mockedVerify.mockResolvedValueOnce({ uid: 'uid-never-synced' });
    await expect(
      requireOwner(makeRequest(bearerHeaders('valid-but-unknown-token'))),
    ).rejects.toMatchObject({ code: 'authentication_required' });
    expect(await Account.countDocuments()).toBe(0);
  });

  it('suspend/resume: a deleted account no longer resolves', async () => {
    await provisionAccount({ uid: 'uid-gone', email: null, displayName: null, photoURL: null });
    await Account.updateOne({ ownerUid: 'uid-gone' }, { $set: { status: 'deleted', deletedAt: new Date() } });

    mockedVerify.mockResolvedValueOnce({ uid: 'uid-gone' });
    await expect(
      requireOwner(makeRequest(bearerHeaders('deleted-owner-token'))),
    ).rejects.toMatchObject({ code: 'authentication_required' });
  });

  it('exports Errors factories from lib/core/errors (no local re-implementation)', () => {
    const err = Errors.authenticationRequired();
    expect(err.code).toBe('authentication_required');
    expect(err.toBody('req_1').error.request_id).toBe('req_1');
  });
});

describe('extractBearerToken', () => {
  it('accepts case-insensitive scheme and returns the trimmed token', () => {
    expect(extractBearerToken(new Headers({ authorization: 'BEARER   abc.def.ghI ' }))).toBe('abc.def.ghI');
    expect(extractBearerToken(new Headers({ authorization: 'bearer token-1' }))).toBe('token-1');
  });

  it('returns null for missing header, wrong scheme, or empty token', () => {
    expect(extractBearerToken(new Headers())).toBeNull();
    expect(extractBearerToken(new Headers({ authorization: 'token no-scheme' }))).toBeNull();
    expect(extractBearerToken(new Headers({ authorization: 'Bearer ' }))).toBeNull();
  });
});
