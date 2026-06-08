'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/Toast';

// ── Types ──────────────────────────────────────────────────────────────────

interface ApiKeyData {
  _id: string;
  name: string;
  tier: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface UsageData {
  tier: string;
  tierName: string;
  price: number;
  callsIncluded: number;
  callsOverage: number;
  totalCalls: number;
  quota: number;
  overageRate: number;
  overageCostDollars: number;
  periodEnd: string;
  subscriptionStatus: string;
}

interface CheckpointData {
  _id: string;
  status: string;
  taskDescription: string;
  agentName: string;
  expiresAt: string;
  createdAt: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
}

interface DlqItem {
  _id: string;
  status: string;
  taskType: string;
  agentName: string;
  error: string;
  retryCount: number;
  createdAt: string;
}

type Tab = 'keys' | 'approvals' | 'dlq';

// ── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, profile, loading, isAuthenticated, ensureProfile, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('keys');
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [keyName, setKeyName] = useState('');
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const fetchedRef = useRef(false);

  // Approvals state
  const [checkpoints, setCheckpoints] = useState<CheckpointData[]>([]);
  const [cpLoading, setCpLoading] = useState(false);

  // DLQ state
  const [dlqItems, setDlqItems] = useState<DlqItem[]>([]);
  const [dlqLoading, setDlqLoading] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/keys', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setKeys(json.data);
    } catch { setError('Failed to load API keys'); }
    finally { setFetching(false); }

    try {
      const token = await user!.getIdToken();
      const usageRes = await fetch('/api/billing/usage', { headers: { Authorization: `Bearer ${token}` } });
      const usageJson = await usageRes.json();
      if (usageJson.success) setUsage(usageJson.data);
    } catch { /* non-critical */ }
  }, [isAuthenticated, user]);

  const fetchCheckpoints = useCallback(async () => {
    if (!isAuthenticated || !profile?.defaultKey) return;
    setCpLoading(true);
    try {
      const res = await fetch('/api/checkpoint?limit=50', {
        headers: { 'x-api-key': profile.defaultKey },
      });
      const json = await res.json();
      if (json.success) setCheckpoints(json.data.items || []);
    } catch { /* silent */ }
    finally { setCpLoading(false); }
  }, [isAuthenticated, profile]);

  const fetchDlq = useCallback(async () => {
    if (!isAuthenticated || !profile?.defaultKey) return;
    setDlqLoading(true);
    try {
      const res = await fetch('/api/dlq?limit=50', {
        headers: { 'x-api-key': profile.defaultKey },
      });
      const json = await res.json();
      if (json.success) setDlqItems(json.data.items || []);
    } catch { /* silent */ }
    finally { setDlqLoading(false); }
  }, [isAuthenticated, profile]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    ensureProfile().then(() => {
      if (!fetchedRef.current) { fetchedRef.current = true; fetchKeys(); }
    });
  }, [isAuthenticated, loading, router, ensureProfile, fetchKeys]);

  useEffect(() => {
    if (tab === 'approvals') fetchCheckpoints();
    if (tab === 'dlq') fetchDlq();
  }, [tab, fetchCheckpoints, fetchDlq]);

  // ── Key actions ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!keyName.trim() || !isAuthenticated) return;
    setCreating(true); setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim() }),
      });
      const json = await res.json();
      if (json.success) { setNewKey(json.data.key); setKeyName(''); fetchKeys(); }
      else setError(json.error || 'Failed to create key');
    } catch { setError('Failed to create key'); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!isAuthenticated) return;
    try {
      const token = await user!.getIdToken();
      const res = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setKeys((prev) => prev.filter((k) => k._id !== id));
    } catch { setError('Failed to revoke key'); }
  };

  const handleCheckpointAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const token = await user!.getIdToken();
      const res = await fetch(`/api/checkpoint/${id}/resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) fetchCheckpoints();
    } catch { /* silent */ }
  };

  const handleDlqRetry = async (id: string) => {
    if (!profile?.defaultKey) return;
    try {
      await fetch(`/api/dlq/${id}/retry`, {
        method: 'POST',
        headers: { 'x-api-key': profile.defaultKey },
      });
      fetchDlq();
    } catch { /* silent */ }
  };

  const handleDlqDismiss = async (id: string) => {
    if (!profile?.defaultKey) return;
    try {
      await fetch(`/api/dlq/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': profile.defaultKey },
      });
      fetchDlq();
    } catch { /* silent */ }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setToastVisible(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const defaultKey = profile?.defaultKey || newKey;
  const pendingCount = checkpoints.filter(c => c.status === 'pending').length;
  const failedCount = dlqItems.filter(d => d.status === 'pending').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Profile</Link>
            <span className="text-sm text-zinc-500">{user?.email}</span>
            <span className="inline-flex rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
              {profile?.tier || 'free'}
            </span>
            <button onClick={logout} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Default API Key */}
        {defaultKey && (
          <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-zinc-300">Your API Key</h2>
              {newKey && (
                <button onClick={() => setNewKey(null)} className="text-xs text-zinc-500 hover:text-zinc-300">Dismiss</button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="rounded bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-200 select-all flex-1 overflow-x-auto">
                {defaultKey}
              </p>
              <button onClick={() => copyKey(defaultKey)} className="shrink-0 rounded-md border border-zinc-700 p-2 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100" title="Copy API key">
                {copied ? (
                  <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-zinc-800">
          <button
            onClick={() => setTab('keys')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'keys' ? 'text-zinc-100 border-zinc-100' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
            API Keys
          </button>
          <button
            onClick={() => setTab('approvals')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${tab === 'approvals' ? 'text-zinc-100 border-zinc-100' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
            Approvals
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-600 text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab('dlq')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${tab === 'dlq' ? 'text-zinc-100 border-zinc-100' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
            Dead Letters
            {failedCount > 0 && (
              <span className="rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">{failedCount}</span>
            )}
          </button>
        </div>

        {/* ── Tab: API Keys ──────────────────────────────────────────────── */}
        {tab === 'keys' && (
          <div>
            <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">API Keys</h2>
              <div className="mb-6 flex gap-3">
                <input
                  type="text"
                  placeholder="Key name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
                <button onClick={handleCreate} disabled={creating || !keyName.trim()} className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                  {creating ? 'Creating...' : 'Create API Key'}
                </button>
              </div>

              {fetching ? (
                <p className="text-sm text-zinc-500">Loading keys...</p>
              ) : keys.length === 0 ? (
                <p className="text-sm text-zinc-500">No API keys yet. Create one above.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Tier</th>
                        <th className="pb-3 pr-4 font-medium">Created</th>
                        <th className="pb-3 pr-4 font-medium">Last Used</th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => (
                        <tr key={k._id} className="border-b border-zinc-800/50">
                          <td className="py-3 pr-4 text-zinc-200">{k.name}</td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{k.tier}</span>
                          </td>
                          <td className="py-3 pr-4 text-zinc-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 pr-4 text-zinc-400">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                          <td className="py-3">
                            <button onClick={() => handleRevoke(k._id)} className="text-sm text-red-400 hover:text-red-300 transition-colors">Revoke</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Usage */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm font-medium text-zinc-400">API Calls This Month</p>
                {usage ? (
                  <>
                    <p className="mt-2 text-2xl font-bold text-zinc-100">
                      {usage.totalCalls.toLocaleString()}
                      {usage.quota !== -1 && <span className="text-sm font-normal text-zinc-500"> / {usage.quota.toLocaleString()}</span>}
                    </p>
                    {usage.quota !== -1 && (
                      <div className="mt-3 h-2 rounded-full bg-zinc-800">
                        <div className={`h-2 rounded-full transition-all ${usage.totalCalls >= usage.quota ? 'bg-red-500' : usage.totalCalls >= usage.quota * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((usage.totalCalls / usage.quota) * 100, 100)}%` }} />
                      </div>
                    )}
                  </>
                ) : <p className="mt-2 text-2xl font-bold text-zinc-500">--</p>}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm font-medium text-zinc-400">Overage Charges</p>
                {usage ? (
                  <p className="mt-2 text-2xl font-bold text-zinc-100">${usage.overageCostDollars.toFixed(2)}</p>
                ) : <p className="mt-2 text-2xl font-bold text-zinc-500">--</p>}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm font-medium text-zinc-400">Current Plan</p>
                {usage ? (
                  <>
                    <p className="mt-2 text-2xl font-bold text-zinc-100">{usage.tierName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{usage.price > 0 ? `$${usage.price}/mo` : 'Free'}</p>
                  </>
                ) : <p className="mt-2 text-2xl font-bold text-zinc-500">--</p>}
              </div>
            </div>

            {usage && usage.tier === 'free' && (
              <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
                <p className="text-zinc-300 mb-2"><span className="font-semibold">Upgrade to Builder</span> — 10,000 calls/mo + overage support</p>
                <Link href="/profile" className="inline-block rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white">View Plans</Link>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Approvals ─────────────────────────────────────────────── */}
        {tab === 'approvals' && (
          <div>
            {!profile?.defaultKey ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-zinc-400">Create an API key first to view checkpoints.</p>
              </div>
            ) : cpLoading ? (
              <p className="text-sm text-zinc-500 py-4">Loading checkpoints...</p>
            ) : checkpoints.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-zinc-400">No checkpoints yet.</p>
                <p className="text-zinc-500 text-sm mt-1">Create one via <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">POST /api/checkpoint</code></p>
              </div>
            ) : (
              <div className="space-y-3">
                {checkpoints.map((cp) => {
                  const isExpired = cp.status === 'expired' || (cp.status === 'pending' && new Date(cp.expiresAt) < new Date());
                  return (
                    <div key={cp._id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            {cp.status === 'pending' && !isExpired && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                                <span className="h-1 w-1 rounded-full bg-amber-400" /> Pending
                              </span>
                            )}
                            {cp.status === 'approved' && (
                              <span className="inline-flex rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">Approved</span>
                            )}
                            {cp.status === 'rejected' && (
                              <span className="inline-flex rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">Rejected</span>
                            )}
                            {isExpired && cp.status === 'pending' && (
                              <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Expired</span>
                            )}
                            <span className="text-xs text-zinc-500">{cp.agentName}</span>
                          </div>
                          <p className="text-sm text-zinc-200 truncate">{cp.taskDescription}</p>
                          <p className="text-xs text-zinc-600 mt-1">
                            {new Date(cp.createdAt).toLocaleString()}
                            {cp.reviewedBy && <> · reviewed by {cp.reviewedBy}</>}
                          </p>
                          {cp.reviewNote && <p className="text-xs text-zinc-500 mt-1">&quot;{cp.reviewNote}&quot;</p>}
                        </div>
                        {cp.status === 'pending' && !isExpired && (
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleCheckpointAction(cp._id, 'approve')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
                              Approve
                            </button>
                            <button onClick={() => handleCheckpointAction(cp._id, 'reject')} className="rounded-md border border-red-700 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/30 transition-colors">
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: DLQ ──────────────────────────────────────────────────── */}
        {tab === 'dlq' && (
          <div>
            {!profile?.defaultKey ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-zinc-400">Create an API key first to view dead letters.</p>
              </div>
            ) : dlqLoading ? (
              <p className="text-sm text-zinc-500 py-4">Loading dead letters...</p>
            ) : dlqItems.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-zinc-400">No dead letters.</p>
                <p className="text-zinc-500 text-sm mt-1">Failed tasks will appear here via <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">POST /api/dlq</code></p>
              </div>
            ) : (
              <div className="space-y-3">
                {dlqItems.map((item) => (
                  <div key={item._id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {item.status === 'pending' && (
                            <span className="inline-flex rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">Failed</span>
                          )}
                          {item.status === 'retried' && (
                            <span className="inline-flex rounded-full bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">Retried</span>
                          )}
                          {item.status === 'dismissed' && (
                            <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Dismissed</span>
                          )}
                          {item.status === 'resolved' && (
                            <span className="inline-flex rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">Resolved</span>
                          )}
                          <span className="text-xs text-zinc-500">{item.agentName}</span>
                          {item.retryCount > 0 && <span className="text-xs text-zinc-600">retry #{item.retryCount}</span>}
                        </div>
                        <p className="text-sm text-zinc-200">{item.taskType}</p>
                        <p className="text-xs text-red-400/80 mt-1 font-mono truncate">{item.error}</p>
                        <p className="text-xs text-zinc-600 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                      {item.status === 'pending' && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleDlqRetry(item._id)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 transition-colors">
                            Retry
                          </button>
                          <button onClick={() => handleDlqDismiss(item._id)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Toast message="Copied to clipboard!" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
