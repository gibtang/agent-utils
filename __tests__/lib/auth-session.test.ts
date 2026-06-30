/**
 * auth-session.verifyUser — verifies the Bearer→token→User→tenantId flow.
 *
 * `verifyFirebaseIdToken` (Google JWKS) is mocked so we don't need a real signed
 * token. The DB layer uses the shared MongoMemoryServer harness.
 */
import '../helpers/mongodb'; // boot MongoMemoryServer + connect mongoose
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the jose-based verifier BEFORE importing the module under test.
vi.mock('@/lib/firebase/verify', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

import { verifyUser } from '@/lib/auth-session';
import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import User from '@/models/v2/User';
import Tenant from '@/models/v2/Tenant';
import { provisionUser } from '@/lib/dashboard/keys'; // to create a real user/tenant for the happy path
import type { NextRequest } from 'next/server';

const mockedVerify = vi.mocked(verifyFirebaseIdToken);
const UID = 'firebase-uid-verify-test';

function bearerReq(token: string | null): NextRequest {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return { headers } as unknown as NextRequest;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await User.deleteMany({});
});

describe('verifyUser', () => {
  it('returns null when no Authorization header is present', async () => {
    const result = await verifyUser(bearerReq(null));
    expect(result).toBeNull();
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('returns null when the token fails verification', async () => {
    mockedVerify.mockResolvedValueOnce(null);
    const result = await verifyUser(bearerReq('bad-token'));
    expect(result).toBeNull();
  });

  it('returns null when the Firebase identity has no matching User record', async () => {
    mockedVerify.mockResolvedValueOnce({ uid: UID, email: 'nobody@example.com' });
    const result = await verifyUser(bearerReq('valid-but-no-user'));
    expect(result).toBeNull();
  });

  it('returns the verified user with their tenantId on the happy path', async () => {
    // Provision a real user + hidden tenant (the normal first-login path).
    const provisioned = await provisionUser({
      uid: UID,
      email: 'real@example.com',
    });
    expect(provisioned.tenantId).toMatch(/^ten_/);

    mockedVerify.mockResolvedValueOnce({
      uid: UID,
      email: 'real@example.com',
      name: 'Real Person',
    });

    const result = await verifyUser(bearerReq('valid-token'));
    expect(result).not.toBeNull();
    expect(result!.uid).toBe(UID);
    expect(result!.email).toBe('real@example.com');
    expect(result!.name).toBe('Real Person');
    expect(result!.tenantId).toBe(provisioned.tenantId);
    // Tenant must actually exist for that id (verifies the link is real).
    const tenant = await Tenant.findOne({ tenantId: provisioned.tenantId }).lean();
    expect(tenant).not.toBeNull();
  });
});
