'use client';

/**
 * Owner dashboard — Handoffs section.
 *
 * Fetches GET /api/handoffs (metadata-only list) and, per expanded row, the
 * GET /api/handoffs/[id]/activity audit feed (events only — NEVER content).
 * Revoke calls DELETE /api/handoffs/[id], which crypto-erases the stored
 * values server-side; the UI says so in plain words before acting.
 *
 * Zero secret display: this component renders only what the two metadata
 * routes return — there is no owner decrypt API and no code path here that
 * could display ciphertext or submitted values.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type HandoffRow = {
  handoffId: string; title: string | null; status: 'awaiting' | 'submitted' | 'closed' | 'expired';
  closureReason: 'done' | 'revoked' | null; createdAt: string; agentId: string;
  retrievalCount: number; lastRetrievedAt: string | null; linkExpiresAt: string; sessionExpiresAt: string;
};
type ActivityRow = { event: string; metadata: Record<string, unknown>; createdAt: string };

const STATUS_LABEL: Record<HandoffRow['status'], string> = { awaiting: 'Awaiting', submitted: 'Submitted', closed: 'Closed', expired: 'Expired' };
const STATUS_BADGE: Record<HandoffRow['status'], string> = {
  awaiting: 'bg-surface-container text-on-surface-variant border-outline-variant',
  submitted: 'bg-primary-container/40 text-on-primary-container border-primary/30',
  closed: 'bg-surface-container text-on-surface-variant border-outline-variant',
  expired: 'bg-surface-container text-on-surface-variant border-outline-variant',
};

function age(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function shortId(handoffId: string): string {
  return handoffId.length > 12 ? `${handoffId.slice(0, 12)}…` : handoffId;
}

function ActivityFeed({ handoffId, token }: { handoffId: string; token: string }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/handoffs/${handoffId}/activity`, { headers: { authorization: `Bearer ${token}` } });
      if (!alive) return;
      if (!res.ok) { setError(true); return; }
      const body = (await res.json().catch(() => null)) as { data?: ActivityRow[] } | null;
      if (alive) setRows(body?.data ?? []);
    })();
    return () => { alive = false; };
  }, [handoffId, token]);
  if (error) return <p className="text-xs text-error">Couldn&apos;t load the audit trail.</p>;
  if (!rows) return <p className="text-xs text-on-surface-variant">Loading audit trail…</p>;
  if (rows.length === 0) return <p className="text-xs text-on-surface-variant">No activity recorded yet.</p>;
  return (
    <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
      {rows.map((row, index) => (
        <li key={index} className="flex items-baseline gap-2">
          <span className="font-mono text-on-surface">{row.event}</span>
          <span>{new Date(row.createdAt).toLocaleString()}</span>
          {typeof row.metadata?.reason === 'string' ? <span className="opacity-80">({row.metadata.reason})</span> : null}
        </li>
      ))}
    </ul>
  );
}

export default function HandoffsSection() {
  const { getIdToken } = useAuth();
  const [rows, setRows] = useState<HandoffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const token = await getIdToken();
    if (!token) { setError('Please sign in again.'); setRows([]); return; }
    const res = await fetch('/api/handoffs', { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) { setError('Unable to load handoffs.'); setRows([]); return; }
    const body = (await res.json().catch(() => null)) as { data?: HandoffRow[] } | null;
    setRows(body?.data ?? []);
  }, [getIdToken]);

  // Set-state-inside-effect is flagged because `load()` calls setState from
  // the effect body; it is async (network fetch), not a synchronous cascading
  // render — same async-fetch pattern as the other dashboard client pages.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, not sync cascading setState
  useEffect(() => { void load(); }, [load]);

  async function revoke(handoffId: string) {
    setBusy(true); setError(null);
    const token = await getIdToken();
    const res = token
      ? await fetch(`/api/handoffs/${handoffId}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })
      : null;
    setBusy(false); setConfirming(null);
    if (!res || !res.ok) { setError(res?.status === 409 ? 'This handoff is already closed or expired.' : 'Unable to revoke this handoff.'); return; }
    await load();
  }

  if (rows === null) return <p className="text-sm text-on-surface-variant">Loading handoffs…</p>;
  if (rows.length === 0 && !error) {
    return (
      <section className="rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-8 text-sm text-on-surface-variant">
        <p className="font-medium text-on-surface">No credential handoffs yet</p>
        <p className="mt-2">Ask your agent for a handoff link — it shows up here with its status and audit trail.</p>
      </section>
    );
  }

  return (
    <section aria-label="Credential handoffs" className="rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-6">
      <h2 className="text-lg font-semibold text-on-surface">Credential handoffs</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Values are encrypted at rest and are never shown in the dashboard. Agents decrypt them, not you.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
      <ul className="mt-4 divide-y divide-border-subtle">
        {rows.map((row) => {
          const revocable = row.status === 'awaiting' || row.status === 'submitted';
          const open = expanded === row.handoffId;
          return (
            <li key={row.handoffId} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-on-surface">{row.title ?? 'Untitled handoff'}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    <span className="font-mono">{shortId(row.handoffId)}</span>
                    {' · '}by {row.agentId}
                    {' · '}{age(row.createdAt)}
                    {' · '}{row.retrievalCount} retrieval{row.retrievalCount === 1 ? '' : 's'}
                    {row.lastRetrievedAt ? ` · last ${age(row.lastRetrievedAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setExpanded(open ? null : row.handoffId); setConfirming(null); }}
                    aria-expanded={open}
                    className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container"
                  >
                    {open ? 'Hide audit' : 'View audit'}
                  </button>
                  {revocable && confirming !== row.handoffId && (
                    <button
                      onClick={() => setConfirming(row.handoffId)}
                      className="rounded-lg border border-error/40 px-3 py-1.5 text-xs text-error transition-colors hover:bg-error-container/20"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
              {confirming === row.handoffId && (
                <div className="mt-3 rounded-lg border border-error/40 bg-error-container/20 px-3 py-3 text-sm">
                  <p className="text-on-surface">
                    Revoke “{row.title ?? 'Untitled handoff'}” ({shortId(row.handoffId)})?
                  </p>
                  <p className="mt-1 text-on-surface-variant">
                    Revoking permanently erases the stored values — this cannot be undone.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => void revoke(row.handoffId)}
                      className="rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? 'Revoking…' : 'Yes, revoke now'}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {open && <AuditRow handoffId={row.handoffId} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Loads the token lazily so rows without an expanded audit stay fetch-free. */
function AuditRow({ handoffId }: { handoffId: string }) {
  const { getIdToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { let alive = true; void getIdToken().then((value) => { if (alive) setToken(value); }); return () => { alive = false; }; }, [getIdToken]);
  if (!token) return <p className="text-xs text-on-surface-variant">Loading audit trail…</p>;
  return <div className="mt-3 border-l-2 border-border-subtle pl-3"><ActivityFeed handoffId={handoffId} token={token} /></div>;
}
