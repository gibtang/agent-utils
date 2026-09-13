import type { NextRequest } from 'next/server';
import { Errors } from '@/lib/core/errors';
import { extractBearerToken } from '@/lib/owner/auth';
import { authenticateConnection, type ConnectionActor } from './service';

/** Resolve a scoped connection actor from an au_conn bearer credential. */
export async function requireConnection(request: NextRequest | Request): Promise<ConnectionActor> {
  const token = extractBearerToken(request.headers);
  if (!token) throw Errors.authenticationRequired();
  return authenticateConnection(token);
}
