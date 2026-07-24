import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { resourceId } from '@/lib/v2/ids';
import { agentIdOf } from '@/lib/v2/auth';
import { validateCallbackUrl } from '@/lib/v2/callbackSecurity';
import { releaseMonthlyConfessionQuota, reserveMonthlyConfessionQuota } from '@/lib/v2/quota';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';
import Confession, { type IConfession, type ConfessionTimeoutAction, type ConfessionStatus } from '@/models/v2/Confession';

const CONTEXT_MAX = 50 * 1024;
const REQUEST_MAX = 64 * 1024;
const MAX_CONCERNS = 100;
const MIN_TIMEOUT = 60;
const MAX_TIMEOUT = 604800;
const DEFAULT_TIMEOUT = 86400;
const RETENTION_DAYS = 30;
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v), 'utf8');

function serialize(c: IConfession) {
  return { id: c.confessionId, agent_id: c.agentId, summary: c.summary, concerns: c.concerns, confidence: c.confidence, context: c.context, urgency: c.urgency, blocking: c.blocking, ...(c.blocking && c.status === 'open' ? { poll_after_seconds: 5 } : {}), status: c.status, expires_at: c.expiresAt.toISOString(), timeout_action: c.timeoutAction, callback_url: c.callbackUrl, created_at: c.createdAt?.toISOString() };
}

/** Creation is non-blocking. `blocking` tells the client to poll after five seconds. */
export const POST = createRoute({ agentKey: true, idempotent: 'POST /v1/confessions' }, async ctx => {
  const b = ctx.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return Errors.validation('JSON body must be an object');
  const body = b as Record<string, unknown>;
  if (typeof body.summary !== 'string' || !body.summary.trim() || body.summary.length > 4096) return Errors.validation('summary required, max 4096 chars', { field: 'summary' });
  if (!Array.isArray(body.concerns) || !body.concerns.length || body.concerns.length > MAX_CONCERNS || body.concerns.some(x => typeof x !== 'string' || !x.trim() || x.length > 2048)) return Errors.validation('concerns must contain 1..100 nonempty strings of at most 2048 chars', { field: 'concerns' });
  if (typeof body.confidence !== 'number' || !Number.isFinite(body.confidence) || body.confidence < 0 || body.confidence > 1) return Errors.validation('confidence must be 0..1', { field: 'confidence' });
  if (body.context !== undefined && bytes(body.context) > CONTEXT_MAX) return Errors.payloadTooLarge('context max 50KB');
  if (bytes(body) > REQUEST_MAX) return Errors.payloadTooLarge('confession request max 64KB');
  if (body.urgency !== undefined && !['low', 'medium', 'high', 'blocking'].includes(String(body.urgency))) return Errors.validation('invalid urgency', { field: 'urgency' });
  if (body.blocking !== undefined && typeof body.blocking !== 'boolean') return Errors.validation('blocking must be a boolean', { field: 'blocking' });
  if (body.timeout_action !== undefined && !['continue', 'abort', 'escalate_to_dlq'].includes(String(body.timeout_action))) return Errors.validation('invalid timeout_action', { field: 'timeout_action' });
  if (body.callback_url !== undefined) {
    if (typeof body.callback_url !== 'string') return Errors.validation('callback_url must be a valid HTTPS URL', { field: 'callback_url' });
    const validated = await validateCallbackUrl(body.callback_url);
    if (!validated.ok) return validated.error!;
  }
  const timeout = body.timeout_seconds ?? DEFAULT_TIMEOUT;
  if (typeof timeout !== 'number' || !Number.isInteger(timeout) || timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) return Errors.validation('timeout_seconds must be 60..604800', { field: 'timeout_seconds' });

  const quota = await reserveMonthlyConfessionQuota(ctx.resolved.tenantId, ctx.resolved.plan);
  if (!quota.ok) return Errors.quotaExceeded('confessions_monthly', quota.used, quota.limit);
  // Shared idempotency persists snapshots after handlers execute. It does not
  // atomically claim concurrent first requests; quota is safe, but a same-key
  // simultaneous create can duplicate. That requires a shared claim protocol.
  const now = new Date();
  let confession: IConfession;
  try {
    confession = await Confession.create({ confessionId: resourceId('conf_'), tenantId: ctx.resolved.tenantId, agentId: agentIdOf(ctx.resolved), summary: (body.summary as string).trim(), concerns: body.concerns as string[], confidence: body.confidence as number, context: body.context ?? null, urgency: (body.urgency as 'low' | 'medium' | 'high' | 'blocking' | undefined) ?? 'medium', blocking: (body.blocking as boolean | undefined) ?? false, status: 'open', expiresAt: new Date(now.getTime() + timeout * 1000), timeoutAction: (body.timeout_action as ConfessionTimeoutAction | undefined) ?? 'continue', callbackUrl: (body.callback_url as string | undefined) ?? null, expiresAtPurge: new Date(now.getTime() + RETENTION_DAYS * 86400_000) });
  } catch (error) {
    // Reservation and insertion are separate operations; compensate on failure.
    await releaseMonthlyConfessionQuota(ctx.resolved.tenantId, quota.month);
    throw error;
  }
  return { kind: 'created' as const, data: serialize(confession) };
});

export const GET = createRoute({ agentKey: true }, async ctx => {
  const url = new URL(ctx.req.url);
  const filter: Record<string, unknown> = { tenantId: ctx.resolved.tenantId };
  const status = url.searchParams.get('status');
  if (status && !['open', 'resolved', 'expired'].includes(status)) return Errors.validation('invalid status', { field: 'status' });
  if (status) filter.status = status as ConfessionStatus;
  const agent = url.searchParams.get('agent_id');
  if (agent) filter.agentId = agent;
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (cursor?._id) {
    const mongoose = (await import('mongoose')).default;
    filter._id = { $lt: new mongoose.Types.ObjectId(String(cursor._id)) };
  }
  const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
  const rows = await Confession.find(filter).sort({ _id: -1 }).limit(limit + 1).lean() as IConfession[];
  const more = rows.length > limit;
  const slice = more ? rows.slice(0, limit) : rows;
  return { kind: 'list' as const, data: slice.map(serialize), cursor: more ? encodeCursor({ _id: String(slice.at(-1)!._id) }) : '', has_more: more };
});
