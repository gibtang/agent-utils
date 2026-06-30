/**
 * POST /api/auth/sync — upsert the signed-in user + run first-login onboarding.
 *
 * Auth: Firebase ID token via `Authorization: Bearer <idToken>`.
 *
 * On every call this is idempotent: it ensures a User + hidden Tenant exist for
 * the Firebase identity. On FIRST-EVER login it also mints one default API key
 * and returns its plaintext once (so the client can show it for the user to
 * copy). Subsequent calls return { new_key: null }.
 */
import { NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { provisionUser } from '@/lib/dashboard/keys';
import { Errors, isApiError } from '@/lib/v2/errors';
import { errorResponse } from '@/lib/v2/envelope';

export async function POST(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  if (!/^bearer\s+/i.test(header)) {
    return errorResponse(Errors.missingAuth());
  }
  const idToken = header.replace(/^bearer\s+/i, '').trim();

  const decoded = await verifyFirebaseIdToken(idToken);
  if (!decoded) {
    return errorResponse(Errors.invalidCreds());
  }

  try {
    const result = await provisionUser({
      uid: decoded.uid,
      email: decoded.email ?? '',
      displayName: decoded.name,
      photoURL: decoded.picture,
    });
    return NextResponse.json(
      {
        data: {
          uid: decoded.uid,
          email: decoded.email ?? null,
          is_new_user: result.isNewUser,
          tenant_id: result.tenantId,
          new_key: result.newKey
            ? { agent_id: result.newKey.agentId, api_key: result.newKey.apiKey }
            : null,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    if (isApiError(e)) return errorResponse(e);
    console.error('[auth/sync]', e);
    return errorResponse(Errors.internal());
  }
}
