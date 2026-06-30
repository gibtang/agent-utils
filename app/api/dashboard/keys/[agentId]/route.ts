/**
 * DELETE /api/dashboard/keys/[agentId] — deactivate + remove a named key.
 *
 * Auth: Firebase ID token via `Authorization: Bearer <idToken>`.
 */
import type { NextRequest } from 'next/server';
import { errorResponse, noContent } from '@/lib/v2/envelope';
import { Errors } from '@/lib/v2/errors';
import { verifyUser } from '@/lib/auth-session';
import { deleteKey } from '@/lib/dashboard/keys';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ agentId: string }> },
) {
  const user = await verifyUser(req);
  if (!user) return errorResponse(Errors.missingAuth());

  const { agentId } = await ctx.params;
  const removed = await deleteKey(user.tenantId, agentId);
  if (!removed) return errorResponse(Errors.notFound('key'));
  return noContent();
}
