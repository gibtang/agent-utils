'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useKindeBrowserClient } from '@kinde-oss/kinde-auth-nextjs';

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
  const { user, profile, loading, isAuthenticated, LogoutLink, ensureProfile } = useAuth();
  const { getAccessTokenRaw } = useKindeBrowserClient();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [keyName, setKeyName] = useState('');
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<UsageData | null>(null);
  const fetchedRef = useRef(false);

  const fetchKeys = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = await getAccessTokenRaw();
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
      const token = await getAccessTokenRaw();
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
  }, [isAuthenticated, getAccessTokenRaw]);

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
      const token = await getAccessTokenRaw();
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
      const token = await getAccessTokenRaw();
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

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isFirstTime = !fetching && keys.length === 0 && !newKey;

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
            <LogoutLink
              postLogoutRedirectURL="/"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              Logout
            </LogoutLink>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* First-time CTA */}
        {isFirstTime && (
          <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold mb-2">Get started</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Create an API key to start integrating AgentUtils into your agents.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder='e.g. "my-production-agent"'
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <button
                onClick={handleCreate}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
              >
                Create API Key
              </button>
            </div>
          </div>
        )}

        {/* New Key Alert */}
        {newKey && (
          <div className="mb-6 rounded-md bg-amber-900/30 border border-amber-700 px-4 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-amber-300">
                  Copy now — won&apos;t be shown again!
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="rounded bg-zinc-900 px-3 py-2 font-mono text-sm text-amber-200 select-all">
                    {newKey}
                  </p>
                  <button
                    onClick={copyKey}
                    className="rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-3 rounded-md bg-zinc-900 p-3 text-xs text-zinc-400 font-mono">
                  <p className="text-zinc-500"># Try it now:</p>
                  <p className="mt-1">curl https://agentutils.dev/api/health \</p>
                  <p className="ml-4">-H &quot;x-api-key: {newKey}&quot;</p>
                </div>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="ml-4 text-amber-400 hover:text-amber-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* API Keys Section */}
        {!isFirstTime && (
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
        )}

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
    </div>
  );
}
