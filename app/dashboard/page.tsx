'use client';

/**
 * /dashboard — manage your API keys.
 *
 * Requires authentication: redirects to /login when signed out. Lists the user's
 * keys (masked), lets them create named keys (plaintext shown once) and delete
 * keys. The auto-created onboarding key (from first login) is surfaced once via
 * the AuthProvider's `newKey`.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

interface KeyRow {
  agent_id: string;
  created_at: string;
  api_key_masked: string;
}

interface PlainKey {
  agent_id: string;
  api_key: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout, getIdToken, newKey, clearNewKey } = useAuth();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [plan, setPlan] = useState('free');
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<PlainKey | null>(null);

  const loadKeys = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setDataLoading(true);
    try {
      const res = await fetch('/api/dashboard/keys', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load keys');
      const json = (await res.json()) as { data?: { keys?: KeyRow[]; plan?: string } };
      setKeys(json.data?.keys ?? []);
      setPlan(json.data?.plan ?? 'free');
    } catch {
      setError('Could not load your keys. Try refreshing.');
    } finally {
      setDataLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
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
      if (!res.ok && res.status !== 204) throw new Error('Could not delete key');
      await loadKeys();
    } catch {
      setError('Could not delete key. Try again.');
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
                    {k.api_key_masked}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SnippetButton agentId={k.agent_id} />
                  <button
                    onClick={() => void handleDelete(k.agent_id)}
                    className="rounded-md border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:border-error/50 hover:text-error"
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
        <span className="text-sm font-semibold text-primary-fixed-dim">Copy your API key now</span>
        <span className="text-xs text-on-surface-variant">(shown only once)</span>
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
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onCreate(name);
    setName('');
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-6 flex flex-wrap items-end gap-3">
      <label className="block flex-1 min-w-[200px]">
        <span className="mb-1.5 block text-xs font-medium text-on-surface-variant">
          New key name{' '}
          <span className="text-on-surface-variant/60">(lowercase, 3–32 chars)</span>
        </span>
        <input
          type="text"
          pattern="[a-z0-9][a-z0-9-]{2,31}"
          required
          placeholder="production"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary-fixed-dim"
        />
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

function SnippetButton({ agentId }: { agentId: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const snippet = `-H "x-agent-id: ${agentId}" -H "x-api-key: YOUR_KEY"`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }
  return (
    <button
      onClick={() => void copy()}
      className="rounded-md border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:text-on-surface"
      title="Copy curl headers"
    >
      {copied ? 'Copied!' : 'Headers'}
    </button>
  );
}
