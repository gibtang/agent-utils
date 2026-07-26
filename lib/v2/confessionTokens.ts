/**
 * AgentUtils v2 — Confession magic-link token issue/verify.
 *
 * Tokens are 32 random bytes (`ct_<hex>`), stored as a sha256 hash so a DB
 * read cannot grant access. `view` scope is reusable until expiry; `resolve`
 * scope is single-use (revoked on first successful resolution).
 *
 * Tokens never carry content — the URL `/c/{id}?t=ct_...` reveals nothing;
 * the page loads title/summary only after a token resolves to a valid grant.
 */
import connectDB from './db';
import ConfessionToken, { hashConfessionToken, type ConfessionTokenScope, type IConfessionToken } from '@/models/v2/ConfessionToken';
import Confession from '@/models/v2/Confession';
import { resourceId, generateConfessionToken } from './ids';
import { Errors, ApiError } from './errors';

const VIEW_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESOLVE_TTL_MS = 24 * 60 * 60 * 1000;

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export interface IssuedToken {
  plaintext: string; // embed in URL; never persisted
  tokenId: string; // internal id (hash lookup)
  scope: ConfessionTokenScope;
  expiresAt: Date;
}

export interface VerifiedToken {
  ok: true;
  token: IConfessionToken;
  confessionId: string;
  tenantId: string;
  scope: ConfessionTokenScope;
}

/**
 * Issue a token for a given confession. The confession must exist in the
 * supplied tenant (token issuance is a server-side operation, not exposed by
 * a public route).
 */
export async function issueConfessionToken(args: {
  confessionId: string;
  tenantId: string;
  scope: ConfessionTokenScope;
  now?: Date;
}): Promise<IssuedToken> {
  await connectDB();
  const now = args.now ?? new Date();
  const ttl = args.scope === 'view' ? VIEW_TTL_MS : RESOLVE_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);
  const plaintext = generateConfessionToken();
  const token = await ConfessionToken.create({
    tokenId: resourceId('cti_'),
    tokenHash: hashConfessionToken(plaintext),
    confessionId: args.confessionId,
    tenantId: args.tenantId,
    scope: args.scope,
    expiresAt,
    usedAt: null,
  });
  return { plaintext, tokenId: token.tokenId, scope: args.scope, expiresAt };
}

/**
 * Verify a presented plaintext token. Optionally consume it (mark used) —
 * required for `resolve` scope (single-use). Returns the token + the
 * confession/tenant it grants access to.
 *
 * Cross-tenant verification: the token's tenantId must match the confession's
 * tenantId, and the confession must still exist.
 */
export async function verifyConfessionToken(
  plaintext: string,
  opts: { consume?: boolean; now?: Date } = {},
): Promise<VerifiedToken | ApiError> {
  await connectDB();
  if (!plaintext || !plaintext.startsWith('ct_')) {
    return Errors.confessionTokenInvalid();
  }
  const token = await ConfessionToken.findOne({ tokenHash: hashConfessionToken(plaintext) }).lean();
  if (!token) return Errors.confessionTokenInvalid();

  const now = opts.now ?? new Date();
  if (token.expiresAt.getTime() <= now.getTime()) return Errors.confessionTokenInvalid();
  if (token.scope === 'resolve' && token.usedAt) return Errors.confessionTokenInvalid();

  // Defensive constant-time check on the hash (DB lookup already enforced uniqueness).
  const expected = hashConfessionToken(plaintext);
  if (!timingSafeEqualStr(expected, token.tokenHash)) return Errors.confessionTokenInvalid();

  const confession = await Confession.findOne({ confessionId: token.confessionId }).lean();
  if (!confession) return Errors.confessionTokenInvalid();
  // Tenant must match — a token from one tenant cannot read another's confession.
  if (confession.tenantId !== token.tenantId) return Errors.confessionTokenInvalid();

  if (opts.consume && token.scope === 'resolve' && !token.usedAt) {
    await ConfessionToken.updateOne({ _id: token._id }, { $set: { usedAt: now } });
  }

  return {
    ok: true,
    token: token as IConfessionToken,
    confessionId: token.confessionId,
    tenantId: token.tenantId,
    scope: token.scope,
  };
}
