/**
 * AgentUtils — session auth for browser-authenticated routes.
 *
 * Browser clients hold a Firebase ID token (managed by the Firebase SDK) and
 * send it as `Authorization: Bearer <idToken>`. These helpers verify that token
 * server-side against Google's public JWKS (no Admin SDK / service-account
 * secrets) and resolve it to our internal {uid, tenantId}.
 *
 * This is distinct from the v2 agent-key auth (`x-api-key`): key auth is for
 * agents calling tools; bearer auth is for the logged-in dashboard user.
 */
import type { NextRequest } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import connectDB from '@/lib/v2/db';
import User from '@/models/v2/User';

export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  tenantId: string;
}

/**
 * Extract + verify the Bearer ID token on a request. Returns the verified user
 * (with their internal tenantId) or null if unauthenticated / unverifiable.
 */
export async function verifyUser(req: NextRequest): Promise<VerifiedUser | null> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header || !/^bearer\s+/i.test(header)) return null;
  const idToken = header.replace(/^bearer\s+/i, '').trim();
  if (!idToken) return null;

  const decoded = await verifyFirebaseIdToken(idToken);
  if (!decoded) return null;

  await connectDB();
  const user = await User.findOne({ firebaseUid: decoded.uid }).lean();
  if (!user) return null;

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
    picture: decoded.picture,
    tenantId: user.tenantId,
  };
}

/** Header helper for clients calling bearer-protected routes. */
export function bearerHeaders(idToken: string): Record<string, string> {
  return { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' };
}
