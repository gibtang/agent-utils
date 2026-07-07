/**
 * Dashboard key management — browser-authenticated (Firebase ID token).
 *
 * GET  /api/dashboard/keys        — list the user's keys (plaintext).
 * POST /api/dashboard/keys        — create a named key; returns plaintext.
 * POST /api/dashboard/keys        — { action: 'reacquire' } wipes legacy hashed
 *                                    keys and mints a fresh default (recovery).
 */
import type { NextRequest } from 'next/server';
import { errorResponse, ok, created } from '@/lib/v2/envelope';
import { Errors } from '@/lib/v2/errors';
import { verifyUser } from '@/lib/auth-session';
import { listKeys, createKey, reacquireKey, ValidationError } from '@/lib/dashboard/keys';

export async function GET(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return errorResponse(Errors.missingAuth());

  const tenant = await import('@/models/v2/Tenant').then((m) =>
    m.default.findOne({ tenantId: user.tenantId }).lean(),
  );
  const keys = await listKeys(user.tenantId);
  // Signal to the UI that one or more keys need recovery so it can show a
  // banner + action rather than crashing in maskKey().
  const needsRecovery = keys.some((k) => k.legacy);
  return ok({ keys, plan: tenant?.plan ?? 'free', needs_recovery: needsRecovery });
}

export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return errorResponse(Errors.missingAuth());

  let body: { name?: unknown; action?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse(Errors.validation('Invalid JSON body'));
  }

  const tenant = await import('@/models/v2/Tenant').then((m) =>
    m.default.findOne({ tenantId: user.tenantId }).lean(),
  );
  const plan = tenant?.plan ?? 'free';

  // Recovery action: wipe legacy (unrecoverable hashed) keys + re-mint default.
  if (body.action === 'reacquire') {
    try {
      const newKey = await reacquireKey(user.tenantId);
      return created({ key: newKey, recovered: true });
    } catch (e) {
      console.error('[dashboard/keys POST reacquire]', e);
      return errorResponse(Errors.internal());
    }
  }

  const name = typeof body.name === 'string' ? body.name : '';

  try {
    const createdKey = await createKey(user.tenantId, plan, name);
    return created({ key: createdKey });
  } catch (e) {
    if (e instanceof ValidationError) {
      return errorResponse(Errors.validation(e.message));
    }
    console.error('[dashboard/keys POST]', e);
    return errorResponse(Errors.internal());
  }
}
