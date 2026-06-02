'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/Toast';

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

export default function DashboardPage() {
  const { user, profile, loading, isAuthenticated, ensureProfile, logout } = useAuth();
  const router = useRouter();
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

  const fetchKeys = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setKeys(json.data);
      }
    } catch {
      setError('Failed to load API keys');
    } finally {
      setFetching(false);
    }

    try {
      const token = await user!.getIdToken();
      const usageRes = await fetch('/api/billing/usage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const usageJson = await usageRes.json();
      if (usageJson.success) {
        setUsage(usageJson.data);
      }
    } catch {
      // Usage fetch failure is non-critical
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    ensureProfile().then(() => {
      if (!fetchedRef.current) {
        fetchedRef.current = true;
        fetchKeys();
      }
    });
  }, [isAuthenticated, loading, router, ensureProfile, fetchKeys]);

  const handleCreate = async () => {
    if (!keyName.trim() || !isAuthenticated) return;
    setCreating(true);
    setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: keyName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setNewKey(json.data.key);
        setKeyName('');
        fetchKeys();
      } else {
        setError(json.error || 'Failed to create key');
      }
    } catch {
      setError('Failed to create key');
    } finally {
      setCreating(false);
    }
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
      if (json.success) {
        setKeys((prev) => prev.filter((k) => k._id !== id));
      }
    } catch {
      setError('Failed to revoke key');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setToastVisible(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const defaultKey = profile?.defaultKey || newKey;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Profile
            </Link>
            <span className="text-sm text-zinc-500">{user?.email}</span>
            <span className="inline-flex rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
              {profile?.tier || 'free'}
            </span>
            <button
              onClick={logout}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
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
                <button
                  onClick={() => setNewKey(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Dismiss
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="rounded bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-200 select-all flex-1 overflow-x-auto">
                {defaultKey}
              </p>
              <button
                onClick={() => copyKey(defaultKey)}
                className="shrink-0 rounded-md border border-zinc-700 p-2 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
                title="Copy API key"
              >
                {copied ? (
                  <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* API Keys Section */}
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
              <button
                onClick={handleCreate}
                disabled={creating || !keyName.trim()}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
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
                          <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                            {k.tier}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">
                          {k.lastUsedAt
                            ? new Date(k.lastUsedAt).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleRevoke(k._id)}
                            className="text-sm text-red-400 hover:text-red-300 transition-colors"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        {/* Usage Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">API Calls This Month</p>
            {usage ? (
              <>
                <p className="mt-2 text-2xl font-bold text-zinc-100">
                  {usage.totalCalls.toLocaleString()}
                  {usage.quota !== -1 && (
                    <span className="text-sm font-normal text-zinc-500"> / {usage.quota.toLocaleString()}</span>
                  )}
                </p>
                {usage.quota !== -1 && (
                  <div className="mt-3 h-2 rounded-full bg-zinc-800">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usage.totalCalls >= usage.quota ? 'bg-red-500' : usage.totalCalls >= usage.quota * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((usage.totalCalls / usage.quota) * 100, 100)}%` }}
                    />
                  </div>
                )}
                {usage.quota === -1 && <p className="mt-1 text-xs text-zinc-500">Unlimited</p>}
              </>
            ) : (
              <p className="mt-2 text-2xl font-bold text-zinc-500">--</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">Overage Charges</p>
            {usage ? (
              <>
                <p className="mt-2 text-2xl font-bold text-zinc-100">
                  ${usage.overageCostDollars.toFixed(2)}
                </p>
                {usage.callsOverage > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {usage.callsOverage.toLocaleString()} overage calls @ ${usage.overageRate}/call
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-2xl font-bold text-zinc-500">--</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">Current Plan</p>
            {usage ? (
              <>
                <p className="mt-2 text-2xl font-bold text-zinc-100">
                  {usage.tierName}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {usage.price > 0 ? `$${usage.price}/mo` : 'Free'}
                  {usage.subscriptionStatus === 'past_due' && (
                    <span className="ml-2 text-red-400">Payment overdue</span>
                  )}
                </p>
              </>
            ) : (
              <p className="mt-2 text-2xl font-bold text-zinc-500">--</p>
            )}
          </div>
        </div>

        {/* Upgrade CTA for free tier */}
        {usage && usage.tier === 'free' && (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-zinc-300 mb-2">
              <span className="font-semibold">Upgrade to Builder</span> — 10,000 calls/mo + overage support
            </p>
            <Link
              href="/profile"
              className="inline-block rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
            >
              View Plans
            </Link>
          </div>
        )}
      </div>
      <Toast message="Copied to clipboard!" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
