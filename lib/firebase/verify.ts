/**
 * AgentUtils — Firebase ID-token verification WITHOUT the Admin SDK.
 *
 * Firebase ID tokens are standard JWTs signed by Google's service account
 * `securetoken@system.gserviceaccount.com`. We verify them with Google's
 * public JWKS (`jose`), so the server needs ONLY the public project id — no
 * `firebase-admin` dependency and no `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`
 * service-account secrets to configure. This is how the app verifies the logged-
 * in dashboard user (distinct from agent-key auth on the v2 tool routes).
 *
 * Trade-off vs. firebase-admin's `verifyIdToken(token, true)`: we cannot check
 * token *revocation* (that needs the user-management API, which requires the
 * Admin SDK). Signature, issuer, audience, and expiry are still fully verified.
 * On sign-out the client clears its routing cookie immediately, so the practical
 * exposure window is bounded by token lifetime (≤1h). Standard for non-admin-SDK
 * Firebase integrations.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const FIREBASE_ISSUER = FIREBASE_PROJECT_ID
  ? `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
  : '';

/**
 * Google's public key set for Firebase ID tokens. `jose` fetches + caches these
 * (honouring the endpoint's cache headers) and re-fetches on key rotation.
 */
const JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

export interface DecodedFirebaseToken {
  /** Firebase user id (JWT `sub`). */
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

function strClaim(p: JWTPayload, key: string): string | undefined {
  const v = p[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Verify a Firebase ID token and return its identity claims, or null if the
 * token is missing/malformed/unsigned/expired, or if the project id is unset.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<DecodedFirebaseToken | null> {
  if (!FIREBASE_PROJECT_ID || !idToken) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
    });
    if (!payload.sub) return null;
    return {
      uid: payload.sub,
      email: strClaim(payload, 'email'),
      name: strClaim(payload, 'name'),
      picture: strClaim(payload, 'picture'),
    };
  } catch {
    return null;
  }
}

/** True when server-side verification can run (a project id is configured). */
export const hasTokenVerificationConfig = Boolean(FIREBASE_PROJECT_ID);
