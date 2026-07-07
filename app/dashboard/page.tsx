'use client';

/**
 * /dashboard — manage your API keys.
 *
 * Requires authentication: redirects to /login when signed out. Lists the user's
 * keys (plaintext), lets them create named keys and delete keys. The auto-created
 * onboarding key (from first login) is surfaced once via the AuthProvider's
 * `newKey`. Keys are always re-copyable from the list.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { generateKeyName } from '@/lib/dashboard/keynames';

interface KeyRow {
  agent_id: string;
  created_at: string;
  api_key: string;
  /** True for pre-migration docs whose hashed key is unrecoverable. */
  legacy?: boolean;
}

/** Show prefix + masked tail for display; the real key is copied on click. */
function maskKey(key: string): string {
  if (!key) return '••••';
  const slash = key.lastIndexOf('_');
  if (slash === -1) return '••••';
  return key.slice(0, slash + 1) + '••••';
}

interface PlainKey {
  agent_id: string;
  api_key: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout, getIdToken, newKey, clearNewKey, syncError } = useAuth();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [plan, setPlan] = useState('free');
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<PlainKey | null>(null);
  const [needsRecovery, setNeedsRecovery] = useState(false);

  const loadKeys = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setDataLoading(true);
    try {
      const res = await fetch('/api/dashboard/keys', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Surface the real server reason (e.g. "Auth is not configured",
        // "Required auth header(s) missing") instead of a generic string, so
        // misconfiguration is diagnosable from the UI rather than invisible.
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? `Failed to load keys (HTTP ${res.status})`);
      }
      const json = (await res.json()) as {
        data?: { keys?: KeyRow[]; plan?: string; needs_recovery?: boolean };
      };
      setKeys(json.data?.keys ?? []);
      setPlan(json.data?.plan ?? 'free');
      setNeedsRecovery(Boolean(json.data?.needs_recovery));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your keys. Try refreshing.');
    } finally {
      setDataLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    // Fallback for the stale-cookie edge case: middleware is the primary gate
    // (it redirects unauthenticated /dashboard hits to /login server-side), but
    // if a lingering cookie let someone through whose Firebase session has
    // since expired, bounce them here once the client confirms no user.
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    // Initial key load after sign-in. loadKeys is a data-fetch that calls setState
    // on completion — a legitimate external-data sync, not a derived-state cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void loadKeys();
  }, [user, loadKeys]);

  async function handleCreate(name: string) {
    setError(null);
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard/keys', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? 'Could not create key');
      }
      const json = (await res.json()) as { data?: { key?: PlainKey } };
      await loadKeys();
      if (json.data?.key) {
        clearNewKey();
        setJustCreated(json.data.key);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create key');
    }
  }

  async function handleDelete(agentId: string) {
    setError(null);
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/dashboard/keys/${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        // Surface the real server reason (e.g. "You must keep at least one API
        // key…") instead of a generic string.
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? 'Could not delete key');
      }
      await loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete key. Try again.');
    }
  }

  async function handleReacquire() {
    setError(null);
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard/keys', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reacquire' }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? 'Could not recover keys');
      }
      const json = (await res.json()) as { data?: { key?: PlainKey } };
      await loadKeys();
      if (json.data?.key) {
        clearNewKey();
        setJustCreated(json.data.key);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recover keys. Try again.');
    }
  }

  function dismissFlash() {
    if (newKey) clearNewKey();
    setJustCreated(null);
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  // One-time plaintext: onboarding key takes priority until dismissed.
  const flash: PlainKey | null = newKey ?? justCreated;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">API Keys</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Signed in as {user.email ?? user.uid}
          </p>
        </div>
        <button
          onClick={() => void logout().then(() => router.replace('/login'))}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          Sign out
        </button>
      </header>

      {flash && (
        <KeyReveal agentId={flash.agent_id} apiKey={flash.api_key} onDismiss={dismissFlash} />
      )}

      {error && (
        <p className="mt-6 rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {/* Provisioning failure (e.g. server Admin SDK not configured) — blocks
          key creation entirely, so show it prominently above the form. */}
      {syncError && (
        <div className="mt-6 rounded-lg border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error">
          <p className="font-semibold">Couldn’t finish setting up your account</p>
          <p className="mt-1 opacity-90">{syncError}</p>
          {/Auth is not configured/ .test(syncError) && (
            <p className="mt-2 text-xs opacity-80">
              This is a server-side configuration issue (missing Firebase Admin
              service-account env vars), not something you can fix from here.
            </p>
          )}
        </div>
      )}

      {/* Legacy-key recovery: pre-migration Agent docs have an unrecoverable
          hashed key. Offer a one-click wipe + re-mint so the dashboard is
          usable again. */}
      {needsRecovery && (
        <div className="mt-6 rounded-lg border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error">
          <p className="font-semibold">Some keys need recovery</p>
          <p className="mt-1 opacity-90">
            These keys were created before a storage change and their secret can no
            longer be displayed. Recovering will remove them and issue a fresh
            default key.
          </p>
          <button
            onClick={() => void handleReacquire()}
            className="mt-2 rounded-md bg-error px-3 py-1.5 text-xs font-semibold text-on-error transition-opacity hover:opacity-90"
          >
            Recover keys
          </button>
        </div>
      )}

      <CreateKeyForm onCreate={handleCreate} plan={plan} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Your keys
        </h2>
        {dataLoading ? (
          <p className="mt-4 text-sm text-on-surface-variant">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-8 text-center text-sm text-on-surface-variant">
            No keys yet. Create one above to get started.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {keys.map((k) => (
              <li
                key={k.agent_id}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-on-surface">{k.agent_id}</div>
                  <div className="mt-0.5 font-mono text-xs text-on-surface-variant">
                    {k.legacy ? 'legacy key — recover to view' : maskKey(k.api_key)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!k.legacy && <CopyKeyButton apiKey={k.api_key} />}
                  <button
                    onClick={() => void handleDelete(k.agent_id)}
                    disabled={keys.length === 1}
                    title={
                      keys.length === 1
                        ? 'You must keep at least one API key. Create another key first.'
                        : 'Delete this key'
                    }
                    className="rounded-md border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:border-error/50 hover:text-error disabled:cursor-not-allowed disabled:border-outline-variant/40 disabled:text-on-surface-variant/40 disabled:hover:border-outline-variant/40 disabled:hover:text-on-surface-variant/40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function KeyReveal({
  agentId,
  apiKey,
  onDismiss,
}: {
  agentId: string;
  apiKey: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }
  return (
    <div className="mt-6 rounded-lg border border-primary-fixed-dim/40 bg-primary-fixed/5 px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-primary-fixed-dim">Copy your API key</span>
      </div>
      <code className="mt-2 block break-all rounded-md bg-surface-container-lowest px-3 py-2 font-mono text-xs text-on-surface">
        {apiKey}
      </code>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => void copy()}
          className="rounded-md bg-primary-fixed px-3 py-1.5 text-xs font-semibold text-on-primary-fixed"
        >
          {copied ? 'Copied!' : 'Copy key'}
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md px-2 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
        >
          Dismiss
        </button>
        <span className="ml-auto font-mono text-xs text-on-surface-variant">
          x-agent-id: {agentId}
        </span>
      </div>
    </div>
  );
}

function CreateKeyForm({
  onCreate,
  plan,
}: {
  onCreate: (name: string) => Promise<void>;
  plan: string;
}) {
  const [name, setName] = useState(() => generateKeyName());
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onCreate(name);
    // Offer a fresh suggestion after each create attempt.
    setName(generateKeyName());
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-6 flex flex-wrap items-end gap-3">
      <label className="block flex-1 min-w-[200px]">
        <span className="mb-1.5 block text-xs font-medium text-on-surface-variant">
          New key name{' '}
          <span className="text-on-surface-variant/60">(lowercase, 3–32 chars)</span>
        </span>
        <div className="relative">
          <input
            type="text"
            pattern="[a-z0-9][a-z0-9-]{2,31}"
            required
            placeholder="production"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 pr-10 text-sm text-on-surface outline-none focus:border-primary-fixed-dim"
          />
          <button
            type="button"
            onClick={() => setName(generateKeyName())}
            title="Suggest another name"
            aria-label="Suggest another name"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-base leading-none text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            ↻
          </button>
        </div>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-primary-fixed px-4 py-2.5 text-sm font-semibold text-on-primary-fixed transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create key'}
      </button>
      <span className="text-xs text-on-surface-variant">Plan: {plan}</span>
    </form>
  );
}

function CopyKeyButton({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      /* clipboard may be unavailable */
    }
  }
  return (
    <button
      onClick={() => void copy()}
      className="rounded-md border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:text-on-surface"
      title="Copy API key"
    >
      {copied ? 'Copied' : 'Copy key'}
    </button>
  );
}
