/**
 * POST /api/auth/sync — sign-in handshake for browser owners.
 *
 * Auth: Firebase ID token via `Authorization: Bearer <token>` (verified with
 * the shared public-JWKS verifier — never the routing-hint cookie).
 *
 * Behavior: idempotently provisions the owner's Account (provisionAccount is
 * atomic + idempotent per Firebase uid) and reports onboarding state. The
 * response carries NO credentials of any kind — no tenant_id, no new_key, no
 * API key material. API keys/Agents are created through the Agent pairing
 * flow, never by sign-in.
 *
 * NOTE: this route verifies the token directly instead of calling
 * requireOwner() because first-ever sign-in legitimately has no Account yet;
 * requireOwner() authorizes already-provisioned owners on other routes.
 */
import { Errors } from '@/lib/core/errors';
import { success, failure } from '@/lib/core/envelope';
import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { provisionAccount } from '@/lib/accounts/service';
import { resourceId } from '@/lib/core/ids';
import { NextResponse } from 'next/server';
import Agent from '@/models/Agent';

export async function POST(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  if (!/^bearer\s+/i.test(header)) {
    return nextFailure(Errors.authenticationRequired());
  }
  const idToken = header.replace(/^bearer\s+/i, '').trim();
  if (!idToken) {
    return nextFailure(Errors.authenticationRequired());
  }

  const decoded = await verifyFirebaseIdToken(idToken);
  if (!decoded) {
    return nextFailure(Errors.authenticationRequired());
  }

  try {
    const account = await provisionAccount({
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
      photoURL: decoded.picture ?? null,
    });

    const hasAgent = (await Agent.countDocuments({ accountId: account.accountId })) > 0;

    return NextResponse.json(
      success(
        {
          account: { accountId: account.accountId, plan: account.plan, status: account.status },
          profile: {
            displayName: account.ownerDisplayName ?? null,
            photoUrl: account.ownerPhotoUrl ?? null,
            email: account.ownerEmail ?? null,
          },
          onboarding: { hasAgent },
        },
        resourceId('req_'),
        { status: 200 },
      ).body,
      { status: 200 },
    );
  } catch (e) {
    console.error('[auth/sync]', e);
    return nextFailure(Errors.temporarilyUnavailable());
  }
}

function nextFailure(error: ReturnType<typeof Errors.authenticationRequired>) {
  return NextResponse.json(failure(error, resourceId('req_')).body, { status: error.http });
}
