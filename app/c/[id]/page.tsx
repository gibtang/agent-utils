'use client';

/**
 * /c/{id}?t=ct_... — public Confession review page.
 *
 * The magic-link token in the URL is the only auth. No token (or invalid /
 * expired / used token) → the API returns 401 and this page shows a neutral
 * "link invalid" state with NO confession content leaked. When valid, the page
 * shows title/summary/urgency + Approve / Reject + optional note, and posts to
 * /v1/confessions/{id}/resolve?t=… . The agent's private context is never
 * returned by the API and is never shown here.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface ConfessionView {
  id: string;
  title: string;
  summary: string | null;
  urgency: 'normal' | 'high' | 'blocking';
  status: 'pending' | 'resolved' | 'cancelled' | 'expired';
  requesting_agent: string;
  expires_at: string;
  can_resolve: boolean;
  token_scope: 'view' | 'resolve';
}

function urgencyLabel(u: ConfessionView['urgency']): string {
  return u === 'blocking' ? 'Blocking' : u === 'high' ? 'High' : 'Normal';
}

function urgencyClasses(u: ConfessionView['urgency']): string {
  return u === 'blocking'
    ? 'border-error/50 bg-error-container/20 text-error'
    : u === 'high'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      : 'border-outline-variant bg-surface-container-low text-on-surface-variant';
}

export default function ConfessionReviewPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const search = useSearchParams();
  const token = search.get('t');
  const [resolvedId, setResolvedId] = useState<string>('');
  const [confession, setConfession] = useState<ConfessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'approved' | 'rejected'>(null);
  const [done, setDone] = useState<null | { decision: string }>(null);

  useEffect(() => {
    (async () => {
      const p = params && typeof (params as { then?: unknown }).then === 'function'
        ? await (params as Promise<{ id: string }>)
        : (params as { id: string });
      setResolvedId(p.id);
      if (!token) {
        setError('This review link is missing its access token.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/c/${p.id}?t=${encodeURIComponent(token)}`);
        const j = (await res.json().catch(() => null)) as { data?: ConfessionView; error?: { message?: string } } | null;
        if (!res.ok || !j?.data) {
          setError(j?.error?.message ?? 'This review link is invalid, expired, or has already been used.');
          setLoading(false);
          return;
        }
        setConfession(j.data);
        setLoading(false);
      } catch {
        setError('Could not load this Confession. Please try the link again.');
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit(decision: 'approved' | 'rejected') {
    if (!token || !confession) return;
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/v1/confessions/${resolvedId}/resolve?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, by: 'reviewer', note: note || undefined }),
      });
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) {
        setError(j?.error?.message ?? `Could not submit decision (HTTP ${res.status}).`);
        setBusy(null);
        return;
      }
      setDone({ decision });
      setBusy(null);
    } catch {
      setError('Network error submitting your decision. Please try again.');
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-on-surface-variant">Loading review…</p>
      </main>
    );
  }

  if (error && !confession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <h1 className="text-lg font-semibold text-on-surface">Review link unavailable</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{error}</p>
          <p className="mt-4 text-xs text-on-surface-variant/70">
            Links expire after 24 hours and work only for the Confession they were issued for. If you need a new link, ask the requesting agent to re-issue.
          </p>
        </div>
      </main>
    );
  }

  if (done || (confession && confession.status !== 'pending')) {
    const decision = done?.decision ?? confession?.status;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <h1 className="text-lg font-semibold text-on-surface">Decision recorded</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            This Confession has been marked <span className="font-semibold text-on-surface">{decision}</span>. You can close this window.
          </p>
        </div>
      </main>
    );
  }

  const c = confession!;
  const expiry = new Date(c.expires_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl rounded-xl border border-outline-variant bg-surface-container-lowest p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${urgencyClasses(c.urgency)}`}>
            {urgencyLabel(c.urgency)} urgency
          </span>
          <span className="text-xs text-on-surface-variant">Respond by {expiry}</span>
        </div>
        <h1 className="text-xl font-semibold text-on-surface">{c.title}</h1>
        <p className="mt-1 text-xs text-on-surface-variant">Requested by agent {c.requesting_agent}</p>
        {c.summary && (
          <p className="mt-4 whitespace-pre-wrap rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface">
            {c.summary}
          </p>
        )}

        <label className="mt-6 block">
          <span className="mb-1.5 block text-xs font-medium text-on-surface-variant">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1024}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary-fixed-dim"
            placeholder="Add context for the requesting agent…"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-error">{error}</p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy !== null || !c.can_resolve}
            onClick={() => submit('approved')}
            className="flex-1 rounded-lg bg-primary-fixed px-4 py-2.5 text-sm font-semibold text-on-primary-fixed transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === 'approved' ? 'Approving…' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={busy !== null || !c.can_resolve}
            onClick={() => submit('rejected')}
            className="flex-1 rounded-lg border border-error/50 bg-transparent px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-container/10 disabled:opacity-50"
          >
            {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
        {!c.can_resolve && (
          <p className="mt-3 text-center text-xs text-on-surface-variant/70">
            This link lets you view but not respond. Use the action button from the original email to respond.
          </p>
        )}
      </div>
    </main>
  );
}
