'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { trackConnectionConfirmed, trackPairingCodeCreated } from '@/lib/analytics';

type Runtime = 'codex' | 'hermes' | 'other';

interface Agent {
  agentId: string;
  name: string;
  status: string;
  createdAt: string;
}

interface Connection {
  connectionId: string;
  agentId: string;
  status: string;
  runtime: string | null;
  displayPrefix: string;
  createdAt: string;
}

interface PairingCode {
  code: string;
  expiresAt: string;
}

const RUNTIMES: Array<{ value: Runtime; label: string }> = [
  { value: 'codex', label: 'Codex' },
  { value: 'hermes', label: 'Hermes' },
  { value: 'other', label: 'Another runtime' },
];

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (typeof error?.message === 'string') return error.message;
  }
  return fallback;
}

/** Owner-facing pairing flow. It never displays or stores reusable credentials. */
export default function AgentConnectionsPanel() {
  const { getIdToken } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [agentName, setAgentName] = useState('My agent');
  const [runtime, setRuntime] = useState<Runtime>('codex');
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getIdToken();
      if (!token) throw new Error('Your sign-in session has expired. Sign in again to continue.');
      const headers = new Headers(init.headers);
      headers.set('authorization', `Bearer ${token}`);
      if (init.body) headers.set('content-type', 'application/json');
      const response = await fetch(path, { ...init, headers });
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(errorMessage(body, `Request failed (HTTP ${response.status}).`));
      return body as { data?: unknown };
    },
    [getIdToken],
  );

  const load = useCallback(async () => {
    const [agentBody, connectionBody] = await Promise.all([
      request('/api/agents'),
      request('/api/connections'),
    ]);
    setAgents((agentBody.data as Agent[]) ?? []);
    setConnections((connectionBody.data as Connection[]) ?? []);
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    // Initial sync with the owner-authenticated API is an external data fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load agents.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!pendingAgentId || !pairing) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const body = await request('/api/connections');
        if (cancelled) return;
        const next = (body.data as Connection[]) ?? [];
        setConnections(next);
        const confirmed = next.find(
          (connection) =>
            connection.agentId === pendingAgentId &&
            ['active', 'needs_attention'].includes(connection.status),
        );
        if (confirmed) {
          trackConnectionConfirmed(runtime);
          setPendingAgentId(null);
        }
      } catch {
        // A transient poll failure should not discard the still-valid code.
      }
    };
    const timer = window.setInterval(() => void poll(), 5_000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pairing, pendingAgentId, request, runtime]);

  const connectionsByAgent = useMemo(
    () => new Map(connections.map((connection) => [connection.agentId, connection])),
    [connections],
  );

  async function createAgent() {
    setError(null);
    setBusy(true);
    try {
      await request('/api/agents', {
        method: 'POST',
        body: JSON.stringify({ name: agentName }),
      });
      setAgentName('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the agent.');
    } finally {
      setBusy(false);
    }
  }

  async function createPairingCode(agentId: string) {
    setError(null);
    setBusy(true);
    setCopied(false);
    try {
      const body = await request(`/api/agents/${encodeURIComponent(agentId)}/pairing-code`, {
        method: 'POST',
        body: JSON.stringify({ runtime }),
      });
      const data = body.data as PairingCode;
      setPairing(data);
      setPendingAgentId(agentId);
      trackPairingCodeCreated(runtime);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a pairing code.');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
    } catch {
      setError('Copy was blocked by the browser. Select the code and copy it manually.');
    }
  }

  return (
    <section className="mt-10 rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-6 text-sm text-on-surface-variant">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Connect an agent</h2>
          <p className="mt-1 max-w-2xl">
            Create a short-lived pairing code, then tell your agent to connect with it. The agent receives its private connection credential; this dashboard never displays reusable API keys.
          </p>
        </div>
        <span className="rounded-full border border-outline-variant px-3 py-1 text-xs font-medium text-on-surface-variant">
          {connections.length} connected
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {pairing && (
        <div className="mt-6 rounded-lg border border-primary-fixed-dim/40 bg-primary-fixed/5 px-4 py-4">
          <p className="font-semibold text-primary-fixed-dim">Pairing code ready</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Tell your agent: “Connect to AgentUtils using code”
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="rounded-md bg-surface-container px-3 py-2 font-mono text-base tracking-widest text-on-surface">
              {pairing.code}
            </code>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="min-h-[44px] rounded-md border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Expires at {new Date(pairing.expiresAt).toLocaleTimeString()} and can be used once.
          </p>
          {pendingAgentId && (
            <p className="mt-2 text-xs text-primary-fixed-dim" role="status">
              Waiting for the connection… this page checks every 5 seconds.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border-subtle bg-surface-container px-4 py-4">
        <h3 className="font-medium text-on-surface">Add an agent</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-medium text-on-surface-variant">
            Agent name
            <input
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              placeholder="e.g. Research assistant"
              className="mt-1 min-h-[44px] w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
              maxLength={80}
            />
          </label>
          <button
            type="button"
            disabled={busy || !agentName.trim()}
            onClick={() => void createAgent()}
            className="min-h-[44px] rounded-md bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create agent
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium text-on-surface">Your agents</h3>
          <label className="text-xs font-medium text-on-surface-variant">
            Pairing runtime
            <select
              value={runtime}
              onChange={(event) => setRuntime(event.target.value as Runtime)}
              className="ml-2 min-h-[44px] rounded-md border border-outline-variant bg-surface-container px-2 py-2 text-xs text-on-surface"
            >
              {RUNTIMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        {loading ? (
          <p className="mt-3">Loading agents…</p>
        ) : agents.length === 0 ? (
          <p className="mt-3 rounded-md border border-border-subtle px-3 py-4">Create your first agent above to begin.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {agents.map((agent) => {
              const connection = connectionsByAgent.get(agent.agentId);
              return (
                <li key={agent.agentId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-3">
                  <div>
                    <p className="font-medium text-on-surface">{agent.name}</p>
                    <p className="mt-0.5 text-xs">{connection ? `Connection ${connection.status.replace('_', ' ')}` : 'Not connected yet'}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || Boolean(connection && ['active', 'needs_attention'].includes(connection.status))}
                    onClick={() => void createPairingCode(agent.agentId)}
                    className="min-h-[44px] rounded-md border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {connection && ['active', 'needs_attention'].includes(connection.status) ? 'Connected' : 'Create pairing code'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
