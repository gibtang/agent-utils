/**
 * Dashboard key management — browser-authenticated (Firebase ID token).
 *
 * GET  /api/dashboard/keys        — list the user's keys (plaintext).
 * POST /api/dashboard/keys        — create a named key; returns plaintext.
 */
import type { NextRequest } from 'next/server';
import { errorResponse, ok, created } from '@/lib/v2/envelope';
import { Errors } from '@/lib/v2/errors';
import { verifyUser } from '@/lib/auth-session';
import { listKeys, createKey, ValidationError } from '@/lib/dashboard/keys';

export async function GET(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return errorResponse(Errors.missingAuth());

  const tenant = await import('@/models/v2/Tenant').then((m) =>
    m.default.findOne({ tenantId: user.tenantId }).lean(),
  );
  const keys = await listKeys(user.tenantId);
  return ok({ keys, plan: tenant?.plan ?? 'free' });
}

export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return errorResponse(Errors.missingAuth());

  let body: { name?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse(Errors.validation('Invalid JSON body'));
  }

  const name = typeof body.name === 'string' ? body.name : '';
  const tenant = await import('@/models/v2/Tenant').then((m) =>
    m.default.findOne({ tenantId: user.tenantId }).lean(),
  );
  const plan = tenant?.plan ?? 'free';

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
