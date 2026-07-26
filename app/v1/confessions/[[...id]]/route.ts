/**
 * Confession routes (human-action review + notification).
 *   POST   /v1/confessions                       (agent key, idempotent)
 *   GET    /v1/confessions | /v1/confessions/{id} (agent key)
 *   DELETE /v1/confessions/{id}                   (creating agent cancels own)
 *   POST   /v1/confessions/{id}/resolve           (admin | approval-proxy) — see [id]/resolve/route.ts
 *
 * Creating a Confession persists it, reserves pending-confession quota, and
 * enqueues a default email notification to the tenant reviewer. Email-provider
 * failure does NOT fail creation — the notification job is async and retried by
 * the /v1/tick sweep. The response includes a one-time, opaque review URL the
 * agent may also distribute (in addition to the email).
 */
import { createRoute } from '@/lib/v2/route';
import { Errors } from '@/lib/v2/errors';
import { resourceId } from '@/lib/v2/ids';
import Confession, { type IConfession, type ConfessionUrgency } from '@/models/v2/Confession';
import Tenant from '@/models/v2/Tenant';
import { reserveCountedQuota, releaseCountedQuota } from '@/lib/v2/quota';
import { validateCallbackUrl } from '@/lib/v2/callbackSecurity';
import { issueConfessionToken } from '@/lib/v2/confessionTokens';
import { buildReviewUrl, enqueueNotification, cancelPendingNotifications, writeAuditEntry } from '@/lib/v2/confessions';
import { serializeConfession } from '@/lib/v2/confessionsApi';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';

const HTTPS_RE = /^https:\/\//i;
const CONTEXT_MAX = 50 * 1024;
const PAYLOAD_MAX = 100 * 1024;
const MIN_EXPIRES = 300;
const MAX_EXPIRES = 604800;
const DEFAULT_EXPIRES = 86400;
const RETENTION_DAYS = 30;

function utf8Bytes(s: string): number {
  return typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : new TextEncoder().encode(s).length;
}

function idFromParams(params: { id?: string[] }): string {
  return Array.isArray(params.id) && params.id.length ? params.id[0] : '';
}

// ── POST (create) ────────────────────────────────────────────────────────────
export const POST = createRoute(
  { agentKey: true, idempotent: 'POST /v1/confessions' },
  async (ctx) => {
    const body = (ctx.body ?? {}) as {
      title?: string;
      summary?: string;
      context?: unknown;
      urgency?: string;
      reviewer_email?: string | null;
      expires_in_seconds?: number;
      callback_url?: string;
      callback_payload?: unknown;
    };
    if (!body.title || body.title.length > 256) {
      return Errors.validation('title required, max 256 chars', { field: 'title' });
    }
    if (body.summary !== undefined && body.summary !== null && body.summary.length > 4096) {
      return Errors.validation('summary max 4096 chars', { field: 'summary' });
    }
    if (body.context !== undefined && body.context !== null && utf8Bytes(JSON.stringify(body.context)) > CONTEXT_MAX) {
      return Errors.payloadTooLarge('context max 50KB');
    }
    if (body.urgency && !['normal', 'high', 'blocking'].includes(body.urgency)) {
      return Errors.validation('urgency must be "normal", "high", or "blocking"', { field: 'urgency' });
    }
    if (body.reviewer_email !== undefined && body.reviewer_email !== null) {
      if (typeof body.reviewer_email !== 'string' || body.reviewer_email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.reviewer_email)) {
        return Errors.validation('reviewer_email must be a valid email address', { field: 'reviewer_email' });
      }
    }
    if (!body.callback_url || !HTTPS_RE.test(body.callback_url) || body.callback_url.length > 2048) {
      return Errors.validation('callback_url must be a valid HTTPS URL', { field: 'callback_url' });
    }
    const expiresIn = body.expires_in_seconds ?? DEFAULT_EXPIRES;
    if (!Number.isFinite(expiresIn) || expiresIn < MIN_EXPIRES || expiresIn > MAX_EXPIRES) {
      return Errors.validation('expires_in_seconds must be 300..604800', { field: 'expires_in_seconds' });
    }
    if (body.callback_payload !== undefined && body.callback_payload !== null && utf8Bytes(JSON.stringify(body.callback_payload)) > PAYLOAD_MAX) {
      return Errors.payloadTooLarge('callback_payload max 100KB');
    }

    // SSRF-validate callback URL (same policy as checkpoints).
    const urlCheck = await validateCallbackUrl(body.callback_url);
    if (!urlCheck.ok) return urlCheck.error!;

    // Quota (atomic).
    const q = await reserveCountedQuota(ctx.resolved.tenantId, ctx.resolved.plan, 'pendingConfessionCount', 'confessionsPending');
    if (!q.ok) return Errors.quotaExceeded('confessions_pending', q.used, q.limit);

    const confessionId = resourceId('conf_');
    const agentId = ctx.resolved.kind === 'agent' ? ctx.resolved.agentId : '';
    const now = new Date();

    // Resolve the reviewer email: explicit override → tenant ownerEmail → none.
    let reviewerEmail = body.reviewer_email ?? null;
    if (reviewerEmail === null) {
      const tenant = (await Tenant.findOne({ tenantId: ctx.resolved.tenantId }).lean()) as { ownerEmail?: string } | null;
      reviewerEmail = tenant?.ownerEmail ?? null;
    }

    try {
      const confession = await Confession.create({
        confessionId,
        tenantId: ctx.resolved.tenantId,
        agentId,
        title: body.title,
        summary: body.summary ?? null,
        context: body.context ?? null,
        urgency: (body.urgency as ConfessionUrgency) ?? 'normal',
        status: 'pending',
        reviewerEmail,
        callbackUrl: body.callback_url,
        callbackPayload: body.callback_payload ?? null,
        expiresAt: new Date(now.getTime() + expiresIn * 1000),
        resolutionDecision: null,
        resolutionBy: null,
        resolutionNote: null,
        resolvedAt: null,
        callbackDelivered: false,
        escalatedAt: null,
        expiresAtPurge: new Date(now.getTime() + RETENTION_DAYS * 86400_000),
      });

      // Enqueue the default email notification (persist-before-notify; failures
      // here do not roll back the confession — they are visible via the job's
      // failed status + audit log). The view token is issued per-job so the
      // email link is single-purpose and short-lived.
      if (reviewerEmail) {
        const issued = await issueConfessionToken({ confessionId, tenantId: ctx.resolved.tenantId, scope: 'view', now });
        const reviewUrl = buildReviewUrl(confessionId, issued.plaintext);
        await enqueueNotification({
          confession: confession.toObject() as unknown as import('@/lib/v2/confessions').ConfessionSnapshot,
          recipient: reviewerEmail,
          escalationTier: 0,
          origin: 'created',
          plan: ctx.resolved.plan,
          reviewUrl,
          now,
        }).catch((e) => {
          // Defensive: enqueue is fail-soft; a thrown error must not fail creation.
          console.error('[confession] enqueue default notification failed', e);
        });
      }

      await writeAuditEntry({
        tenantId: ctx.resolved.tenantId,
        agentId,
        action: 'confession.created',
        resourceId: confessionId,
        payload: { title: confession.title, urgency: confession.urgency, reviewer_email: reviewerEmail, expires_at: confession.expiresAt },
        plan: ctx.resolved.plan,
        now,
        requestId: ctx.requestId,
      });

      const data = serializeConfession(confession.toObject() as IConfession, { includeContext: true });
      // Surface a fresh review URL the agent may also distribute (in addition to email).
      const viewToken = await issueConfessionToken({ confessionId, tenantId: ctx.resolved.tenantId, scope: 'view', now });
      return { kind: 'created' as const, data: { ...data, review_url: buildReviewUrl(confessionId, viewToken.plaintext) } };
    } catch (e) {
      await releaseCountedQuota(ctx.resolved.tenantId, 'pendingConfessionCount');
      throw e;
    }
  },
);

// ── GET (list + single) ──────────────────────────────────────────────────────
export const GET = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const id = idFromParams(ctx.params);
  const tenantId = ctx.resolved.tenantId;

  if (id) {
    const c = (await Confession.findOne({ confessionId: id }).lean()) as IConfession | null;
    if (!c || c.tenantId !== tenantId) return Errors.notFound('confession not found');
    return { kind: 'ok' as const, data: serializeConfession(c, { includeContext: true }) };
  }

  const url = new URL(ctx.req.url);
  const filter: Record<string, unknown> = { tenantId };
  const status = url.searchParams.get('status');
  if (status) filter.status = status;
  const agentId = url.searchParams.get('agent_id');
  if (agentId) filter.agentId = agentId;
  const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (cursor?._id) filter._id = { $lt: new (await import('mongoose')).default.Types.ObjectId(String(cursor._id)) };

  const rows = await Confession.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = (hasMore ? rows.slice(0, limit) : rows) as IConfession[];
  const nextCursor = hasMore && slice.length ? encodeCursor({ _id: String(slice[slice.length - 1]._id) }) : undefined;
  return { kind: 'list' as const, data: slice.map((c) => serializeConfession(c)), cursor: nextCursor ?? '', has_more: hasMore };
});

// ── DELETE (creating agent cancels own) ──────────────────────────────────────
export const DELETE = createRoute<{ id?: string[] }>({ agentKey: true }, async (ctx) => {
  const id = idFromParams(ctx.params);
  const c = (await Confession.findOne({ confessionId: id }).lean()) as IConfession | null;
  if (!c || c.tenantId !== ctx.resolved.tenantId) return Errors.notFound('confession not found');
  if (c.agentId !== (ctx.resolved.kind === 'agent' ? ctx.resolved.agentId : '')) {
    return Errors.forbidden('Only the creating agent may cancel');
  }
  if (c.status !== 'pending') return Errors.confessionAlreadyResolved();
  const updated = await Confession.findOneAndUpdate(
    { confessionId: id, status: 'pending' },
    { $set: { status: 'cancelled', resolvedAt: new Date() } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) return Errors.confessionAlreadyResolved();
  await cancelPendingNotifications(id);
  await releaseCountedQuota(ctx.resolved.tenantId, 'pendingConfessionCount');
  await writeAuditEntry({
    tenantId: ctx.resolved.tenantId,
    agentId: c.agentId,
    action: 'confession.cancelled',
    resourceId: id,
    payload: { by: c.agentId },
    plan: ctx.resolved.plan,
    now: new Date(),
    requestId: ctx.requestId,
  });
  return { kind: 'noContent' as const };
});
