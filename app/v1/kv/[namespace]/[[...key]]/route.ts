/**
 * KV Store routes (PRD §8).
 *
 *   GET    /v1/kv/{namespace}/{key}
 *   PUT    /v1/kv/{namespace}/{key}
 *   DELETE /v1/kv/{namespace}/{key}
 *   GET    /v1/kv/{namespace}            (list with prefix)
 *
 * Implemented as a catch-all so keys may contain path-safe characters
 * (colons, dots, underscores, hyphens). Namespace is a path segment; key is the
 * remainder joined with '/'.
 *
 * Tenant isolation is implicit: every query filters tenantId from the resolved
 * credential. Cross-tenant guesses return 404 (not 403) per EC-KV-4.
 */
import { createRoute } from '@/lib/v2/route';
import { agentIdOf } from '@/lib/v2/auth';
import { Errors } from '@/lib/v2/errors';
import KvEntry from '@/models/v2/KvEntry';
import { authorizeNamespace, KEY_RE, NAMESPACE_RE, KV_MAX_VALUE_BYTES, serializedBytes } from '@/lib/v2/kv';
import { reserveKvQuota, adjustKvBytes, releaseKvQuota } from '@/lib/v2/quota';
import { encodeCursor, decodeCursor, clampLimit } from '@/lib/v2/pagination';

type CatchParams = { namespace: string; key?: string[] };

function splitParams(p: Partial<CatchParams>): { namespace: string; key: string | null } {
  const namespace = typeof p.namespace === 'string' ? p.namespace : '';
  const seg = p.key;
  if (!seg || (Array.isArray(seg) && seg.length === 0)) return { namespace, key: null };
  if (Array.isArray(seg)) return { namespace, key: seg.join('/') };
  return { namespace, key: String(seg) };
}

// Helper: compute expiry from optional ttl_seconds.
function computeExpiry(ttlSeconds: number | null | undefined): Date | null {
  if (ttlSeconds === null || ttlSeconds === undefined) return null;
  if (ttlSeconds === 0) return null;
  return new Date(Date.now() + ttlSeconds * 1000);
}

// ── GET (single) / list ─────────────────────────────────────────────────────
export const GET = createRoute<CatchParams>({ agentKey: true }, async (ctx) => {
  const { namespace, key } = splitParams(ctx.params);
  if (!namespace || !NAMESPACE_RE.test(namespace) && namespace !== 'shared') {
    return Errors.validation('namespace must be a valid agent name or "shared"', { field: 'namespace' });
  }
  const auth = authorizeNamespace(agentIdOf(ctx.resolved), namespace);
  if (!auth.ok) return Errors.namespaceForbidden();

  const tenantId = ctx.resolved.tenantId;

  if (key === null) {
    // ── LIST ───────────────────────────────────────────────────────────────
    const url = new URL(ctx.req.url);
    const prefix = url.searchParams.get('prefix') || '';
    const limit = clampLimit(url.searchParams.get('limit'), 50, 100);
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const filter: Record<string, unknown> = { tenantId, namespace };
    if (prefix) filter.key = { $regex: '^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
    if (cursor?._id) filter._id = { $lt: new (await import('mongoose')).default.Types.ObjectId(String(cursor._id)) };

    const now = new Date();
    const rows = await KvEntry.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const data = slice
      .filter((r) => !r.expiresAt || r.expiresAt > now)
      .map((r) => ({
        key: r.key,
        expires_at: r.expiresAt ? r.expiresAt.toISOString() : null,
        version: r.version,
        updated_at: r.updatedAt.toISOString(),
      }));

    const nextCursor = hasMore && slice.length ? encodeCursor({ _id: String(slice[slice.length - 1]._id) }) : undefined;
    return { kind: 'list' as const, data, cursor: nextCursor ?? '', has_more: hasMore };
  }

  // ── SINGLE GET ───────────────────────────────────────────────────────────
  if (!KEY_RE.test(key)) return Errors.validation('key format invalid', { field: 'key' });

  const entry = await KvEntry.findOne({ tenantId, namespace, key }).lean();
  const now = new Date();
  if (!entry || (entry.expiresAt && entry.expiresAt <= now)) {
    return Errors.keyNotFound();
  }

  return {
    kind: 'ok' as const,
    data: {
      key: entry.key,
      namespace: entry.namespace,
      value: entry.value,
      ttl_seconds: entry.ttlSeconds,
      expires_at: entry.expiresAt ? entry.expiresAt.toISOString() : null,
      version: entry.version,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    },
  };
});

// ── PUT (upsert + optional CAS) ─────────────────────────────────────────────
export const PUT = createRoute<CatchParams>({ agentKey: true }, async (ctx) => {
  const { namespace, key } = splitParams(ctx.params);
  if (!namespace || (namespace !== 'shared' && !NAMESPACE_RE.test(namespace))) {
    return Errors.validation('namespace must be a valid agent name or "shared"', { field: 'namespace' });
  }
  const auth = authorizeNamespace(agentIdOf(ctx.resolved), namespace);
  if (!auth.ok) return Errors.namespaceForbidden();

  if (!key || !KEY_RE.test(key)) return Errors.validation('key format invalid', { field: 'key' });

  const body = (ctx.body ?? {}) as { value?: unknown; ttl_seconds?: number | null };
  if (body.value === undefined) {
    return Errors.validation('value is required', { field: 'value' });
  }
  if (body.ttl_seconds !== undefined && body.ttl_seconds !== null) {
    const t = Number(body.ttl_seconds);
    if (!Number.isFinite(t) || t < 0 || t > 2592000) {
      return Errors.validation('ttl_seconds must be 0..2592000', { field: 'ttl_seconds' });
    }
  }
  const valueBytes = serializedBytes(body.value);
  if (valueBytes > KV_MAX_VALUE_BYTES) return Errors.payloadTooLarge('Value exceeds 100KB');

  const tenantId = ctx.resolved.tenantId;
  const ifMatch = ctx.req.headers.get('if-match');
  const expiresAt = computeExpiry(body.ttl_seconds ?? null);

  // Existing entry (raw) for size delta + version reference.
  const existing = await KvEntry.findOne({ tenantId, namespace, key }).lean();
  const existingBytes = existing ? serializedBytes(existing.value) : 0;
  const creatingNew = !existing || (existing.expiresAt && existing.expiresAt <= new Date());

  // Quota: reserve on new key, adjust bytes on overwrite.
  if (creatingNew) {
    const q = await reserveKvQuota(tenantId, ctx.resolved.plan, valueBytes);
    if (!q.ok) return Errors.quotaExceeded('kv_keys', q.used, q.limit);
  } else {
    const delta = valueBytes - existingBytes;
    if (delta !== 0) await adjustKvBytes(tenantId, delta);
  }

  try {
    if (ifMatch !== null) {
      // ── CAS write ────────────────────────────────────────────────────────
      const expected = Number.parseInt(ifMatch, 10);
      if (!Number.isFinite(expected)) {
        return Errors.validation('If-Match must be a version integer', { field: 'If-Match' });
      }
      if (expected === 0) {
        // create-only guard
        if (!creatingNew) return Errors.conflict('Key already exists');
      } else {
        if (creatingNew || existing!.version !== expected) {
          return Errors.versionMismatch(creatingNew ? 0 : existing!.version);
        }
      }
      const updated = await KvEntry.findOneAndUpdate(
        { tenantId, namespace, key, version: creatingNew ? 0 : expected },
        {
          $set: { value: body.value, ttlSeconds: body.ttl_seconds ?? null, expiresAt },
          $inc: { version: 1 },
        },
        { new: true, upsert: expected === 0, setDefaultsOnInsert: true },
      ).lean();
      if (!updated) {
        return Errors.versionMismatch(existing?.version ?? 0);
      }
      return {
        kind: 'ok' as const,
        data: {
          key: updated.key,
          namespace: updated.namespace,
          version: updated.version,
          expires_at: updated.expiresAt ? updated.expiresAt.toISOString() : null,
          updated_at: updated.updatedAt.toISOString(),
        },
      };
    }

    // ── Unconditional upsert (last-write-wins) ────────────────────────────
    const updated = await KvEntry.findOneAndUpdate(
      { tenantId, namespace, key },
      {
        $set: { value: body.value, ttlSeconds: body.ttl_seconds ?? null, expiresAt },
        $inc: { version: 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return {
      kind: 'ok' as const,
      data: {
        key: updated!.key,
        namespace: updated!.namespace,
        version: updated!.version,
        expires_at: updated!.expiresAt ? updated!.expiresAt.toISOString() : null,
        updated_at: updated!.updatedAt.toISOString(),
      },
    };
  } catch (e) {
    // Roll back quota on failure.
    if (creatingNew) await releaseKvQuota(tenantId, valueBytes);
    else await adjustKvBytes(tenantId, existingBytes - valueBytes);
    throw e;
  }
});

// ── DELETE ──────────────────────────────────────────────────────────────────
export const DELETE = createRoute<CatchParams>({ agentKey: true }, async (ctx) => {
  const { namespace, key } = splitParams(ctx.params);
  if (!namespace || (namespace !== 'shared' && !NAMESPACE_RE.test(namespace))) {
    return Errors.validation('namespace must be a valid agent name or "shared"', { field: 'namespace' });
  }
  const auth = authorizeNamespace(agentIdOf(ctx.resolved), namespace);
  if (!auth.ok) return Errors.namespaceForbidden();
  if (!key || !KEY_RE.test(key)) return Errors.validation('key format invalid', { field: 'key' });

  const tenantId = ctx.resolved.tenantId;
  const entry = await KvEntry.findOneAndDelete({ tenantId, namespace, key }).lean();
  if (!entry) return Errors.keyNotFound();
  await releaseKvQuota(tenantId, serializedBytes(entry.value));
  return { kind: 'noContent' as const };
});
