'use client';

/**
 * <ConfessionsInbox /> — dashboard section listing the tenant's Open Confessions.
 *
 * Fetches /api/dashboard/confessions (Firebase bearer auth) and renders the
 * pending list. Reviewers click through to the agent-facing review URL only
 * when they hold a token; from the dashboard they see the metadata (title,
 * urgency, agent, expiry, escalation state) but the actual review/deep-link is
 * distributed via email. A "Copy ID" affordance lets the tenant admin debug.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface ConfessionRow {
  id: string;
  title: string;
  summary: string | null;
  urgency: 'normal' | 'high' | 'blocking';
  status: 'pending' | 'resolved' | 'cancelled' | 'expired';
  requesting_agent: string;
  reviewer_email: string | null;
  escalated: boolean;
  expires_at: string;
  created_at: string;
  resolution?: { decision: string; by: string | null; note: string | null; resolved_at: string };
}

function urgencyLabel(u: ConfessionRow['urgency']): string {
  return u === 'blocking' ? 'Blocking' : u === 'high' ? 'High' : 'Normal';
}
function urgencyClasses(u: ConfessionRow['urgency']): string {
  return u === 'blocking'
    ? 'border-error/50 bg-error-container/20 text-error'
    : u === 'high'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      : 'border-outline-variant bg-surface-container-low text-on-surface-variant';
}

export function ConfessionsInbox() {
  const { getIdToken } = useAuth();
  const [rows, setRows] = useState<ConfessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/confessions?status=${showAll ? '' : 'pending'}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => null)) as { data?: ConfessionRow[]; error?: { message?: string } } | null;
      if (!res.ok || !j?.data) {
        throw new Error(j?.error?.message ?? `Failed to load confessions (HTTP ${res.status})`);
      }
      setRows(j.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load confessions.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, showAll]);

  useEffect(() => {
    // Initial load + reload on showAll toggle. load is a data-fetch that calls
    // setState on completion — a legitimate external-data sync, not a derived
    // state cascade. Same pattern/rule-suppression as app/dashboard/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          {showAll ? 'All Confessions' : 'Open Confessions'}
        </h2>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="rounded-md border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          {showAll ? 'Show open only' : 'Show all'}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-on-surface-variant">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-8 text-center text-sm text-on-surface-variant">
          {showAll ? 'No Confessions yet.' : 'No open Confessions. New action-required items will appear here.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${urgencyClasses(c.urgency)}`}>
                      {urgencyLabel(c.urgency)}
                    </span>
                    {c.escalated && c.status === 'pending' && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                        escalated
                      </span>
                    )}
                    {c.status !== 'pending' && (
                      <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                        {c.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-on-surface">{c.title}</div>
                  <div className="mt-0.5 text-xs text-on-surface-variant">
                    from {c.requesting_agent} · responds by {new Date(c.expires_at).toISOString().replace('T', ' ').slice(0, 16)} UTC
                  </div>
                  {c.summary && (
                    <div className="mt-1 line-clamp-2 text-xs text-on-surface-variant/80">{c.summary}</div>
                  )}
                </div>
                <CopyIdButton id={c.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
      title="Copy Confession ID"
      className="shrink-0 rounded-md border border-outline-variant px-2.5 py-1 font-mono text-[10px] text-on-surface-variant transition-colors hover:bg-surface-container"
    >
      {copied ? 'copied' : 'copy id'}
    </button>
  );
}
