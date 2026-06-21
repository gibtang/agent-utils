/**
 * AgentUtils v2 — cursor pagination helpers (PRD §5.5).
 *
 * Opaque cursor = base64url of the sort tuple. List endpoints decode, append a
 * `$lt` filter, and re-encode the next cursor from the last returned row.
 */
export function encodeCursor(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf8').toString('base64url');
  }
  // Fallback for non-Node
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(cursor: string | undefined | null): Record<string, unknown> | null {
  if (!cursor) return null;
  try {
    let json: string;
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(cursor as string, 'base64url').toString('utf8');
    } else {
      const b64 = (cursor as string).replace(/-/g, '+').replace(/_/g, '/');
      json = decodeURIComponent(escape(atob(b64)));
    }
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Clamp a `limit` query param to the 1..max range. */
export function clampLimit(raw: string | string[] | undefined | null, def = 20, max = 100): number {
  if (Array.isArray(raw)) raw = raw[0];
  if (!raw) return def;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(n, max);
}
