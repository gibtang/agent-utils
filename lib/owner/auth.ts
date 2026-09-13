/**
 * AgentUtils foundation — owner authorization for browser-authenticated routes.
 *
 * The browser client holds a Firebase ID token (managed by the Firebase SDK)
 * and sends it as `Authorization: Bearer *** requireOwner() verifies that
 * token (delegating ALL JWT/JWKS work to lib/firebase/verify.ts — nothing is
 * re-implemented here) and resolves the verified Firebase uid to the owner's
 * Account via the unique `ownerUid` index on models/Account.
 *
 * Security invariants:
 * - The ONLY lookup key is the uid verified from the token. There is no
 *   function parameter, header, cookie, or body field that can select another
 *   owner's account — owner A can never resolve account B.
 * - The `__au_authed` routing-hint cookie is never consulted; it is a client
 *   mirror with no authorization meaning.
 * - Every failure mode (missing header, malformed header, bad token, verified
 *   uid without an Account) is the SAME public error: authentication_required
 *   (401). No information about which step failed leaks to the caller.
 *
 * ACCOUNT LIFECYCLE: requireOwner does NOT provision. Accounts are created
 * exclusively by POST /api/auth/sync (provisionAccount) at sign-in, so a valid
 * token for a uid that has never synced is authentication_required — call sync
 * first.
 */
import type { NextRequest } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { Errors, DomainError } from '@/lib/core/errors';
import { connectDB } from '@/lib/core/db';
import Account from '@/models/Account';

/** A verified Firebase identity resolved to its owning Account. */
export interface OwnerContext {
  accountId: string;
  ownerUid: string;
}

/**
 * Pull the ID token out of the Authorization header. Accepts any
 * casing of the scheme; returns null for a missing header, a non-Bearer
 * scheme, or an empty token.
 */
export function extractBearerToken(headers: Headers): string | null {
  const header = headers.get('authorization');
  if (!header || !/^bearer\s+/i.test(header)) return null;
  const token = header.replace(/^bearer\s+/i, '').trim();
  return token || null;
}

/**
 * Verify the request's Firebase ID token and resolve it to the caller's own
 * Account. Throws Errors.authenticationRequired (a DomainError with
 * http 401) on every failure path — routes translate it once, uniformly.
 */
export async function requireOwner(request: NextRequest): Promise<OwnerContext> {
  const token = extractBearerToken(request.headers);
  if (!token) throw Errors.authenticationRequired();

  // All JWT verification (signature, issuer, audience, expiry) is delegated
  // to lib/firebase/verify.ts. A null return means unverified: reject.
  const decoded = await verifyFirebaseIdToken(token);
  if (!decoded) throw Errors.authenticationRequired();

  await connectDB();
  // Resolution is by verified uid ONLY (unique ownerUid index). No caller-
  // supplied value participates, so cross-owner resolution is impossible.
  const account = await Account.findOne({ ownerUid: decoded.uid }).lean();
  if (!account || account.status === 'deleted') throw Errors.authenticationRequired();

  return { accountId: account.accountId, ownerUid: decoded.uid };
}

/** Type guard so route handlers can branch on the thrown error cleanly. */
export function isAuthError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

/** Header helper for clients calling bearer-protected routes. */
export function bearerHeaders(idToken: string): Record<string, string> {
  return { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' };
}
