/**
 * POST /v1/tick — production cron tick (issue au-2r3).
 *
 * Drives the two time-based v2 engines that cannot run in-request:
 *   1. fireDueSchedules()  — Scheduler retries + DLQ cascade
 *   2. processTimeouts()   — HitL checkpoint auto_reject / dlq expiry
 *
 * Authentication: a shared secret in CRON_SECRET, verified via the standard
 * `Authorization: Bearer <secret>` header. Tenant keys (admin/agent) are
 * intentionally NOT accepted — this endpoint crosses tenant boundaries.
 *
 * Wire this to a Vercel/external cron at ~30–60s intervals.
 */
import { NextRequest } from 'next/server';
import { fireDueSchedules } from '@/lib/v2/scheduler';
import { processTimeouts } from '@/lib/v2/hitl';
import { ok } from '@/lib/v2/envelope';

function unauthorized(): Response {
  return Response.json(
    { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid cron secret.' } },
    { status: 401 },
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function POST(req: NextRequest): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Refuse to run if the operator forgot to set a secret — running unsecured
    // would let anyone trigger schedule fan-out / checkpoint resolution.
    return unauthorized();
  }
  const auth = req.headers.get('authorization') ?? '';
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!presented || !timingSafeEqual(presented, expected)) {
    return unauthorized();
  }

  const [schedules, timeouts] = await Promise.all([
    fireDueSchedules(),
    processTimeouts(),
  ]);

  return ok({ schedules, timeouts });
}
