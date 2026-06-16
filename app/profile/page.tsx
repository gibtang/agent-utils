'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/Toast';

export default function ProfilePage() {
  const { user, profile, loading, isAuthenticated, refreshProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  const handleSaveName = async () => {
    if (!isAuthenticated || name === profile?.name) return;
    setSaving(true);
    setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        refreshProfile();
      } else {
        setError(json.error || 'Failed to update');
      }
    } catch {
      setError('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isAuthenticated) return;
    setDeleting(true);
    setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/user', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        // Redirect to home via logout
        window.location.href = '/';
      } else {
        setError(json.error || 'Failed to delete account');
      }
    } catch {
      setError('Failed to delete account');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!isAuthenticated) return;
    setBillingLoading(true);
    setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      const json = await res.json();
      if (json.success && json.data.url) {
        window.location.href = json.data.url;
      } else {
        setError(json.error || 'Failed to start checkout');
      }
    } catch {
      setError('Failed to start checkout');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!isAuthenticated) return;
    setBillingLoading(true);
    setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data.url) {
        window.location.href = json.data.url;
      } else {
        setError(json.error || 'Failed to open billing portal');
      }
    } catch {
      setError('Failed to open billing portal');
    } finally {
      setBillingLoading(false);
    }
  };

  const copyKey = () => {
    if (profile?.defaultKey) {
      navigator.clipboard.writeText(profile.defaultKey);
      setCopied(true);
      setToastVisible(true);
      setTimeout(() => setCopied(false), 2000);
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

  const tierColors: Record<string, string> = {
    free: 'text-zinc-400 bg-zinc-800',
    builder: 'text-emerald-400 bg-emerald-900/30 border-emerald-800',
    pro: 'text-blue-400 bg-blue-900/30 border-blue-800',
    enterprise: 'text-purple-400 bg-purple-900/30 border-purple-800',
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* API Key */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">API Key</h2>
          {profile?.defaultKey ? (
            <div className="flex items-center gap-3">
              <p className="rounded bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-200 select-all flex-1 overflow-x-auto">
                {profile.defaultKey}
              </p>
              <button
                onClick={copyKey}
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
          ) : (
            <p className="text-sm text-zinc-500">No API key found.</p>
          )}
        </div>

        {/* API Usage */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">API Usage</h2>
          <p className="text-sm text-zinc-400">
            Authentication is handled per-user via your account session. No API key required.
          </p>
        </div>

        {/* Account Info */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
              <p className="text-zinc-200">{user?.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Plan</label>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium border ${tierColors[profile?.tier || 'free'] || tierColors.free}`}>
                {(profile?.tier || 'free').charAt(0).toUpperCase() + (profile?.tier || 'free').slice(1)}
              </span>
            </div>

            {profile?.createdAt && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Member Since</label>
                <p className="text-zinc-200">{new Date(profile.createdAt).toLocaleDateString()}</p>
              </div>
            )}

            {profile?.keyCount !== undefined && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Active API Keys</label>
                <p className="text-zinc-200">{profile.keyCount}</p>
              </div>
            )}
          </div>
        </div>

        {/* Billing & Plan */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Billing & Plan</h2>

          <div className="mb-4 flex items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium border ${tierColors[profile?.tier || 'free'] || tierColors.free}`}>
              {(profile?.tier || 'free').charAt(0).toUpperCase() + (profile?.tier || 'free').slice(1)}
            </span>
            {profile?.tier !== 'free' && profile?.tier !== 'enterprise' && (
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors underline underline-offset-2 disabled:opacity-50"
              >
                Manage billing
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={`rounded-md border p-4 ${profile?.tier === 'free' ? 'border-zinc-600 bg-zinc-800/50' : 'border-zinc-800'}`}>
              <p className="font-medium text-zinc-200">Free</p>
              <p className="text-sm text-zinc-500">$0/mo &middot; 500 calls</p>
              {profile?.tier === 'free' && (
                <p className="mt-2 text-xs text-zinc-400">Current plan</p>
              )}
            </div>

            <div className={`rounded-md border p-4 ${profile?.tier === 'builder' ? 'border-emerald-700 bg-emerald-900/20' : 'border-zinc-800'}`}>
              <p className="font-medium text-zinc-200">Builder</p>
              <p className="text-sm text-zinc-500">$19/mo &middot; 10,000 calls</p>
              {profile?.tier === 'builder' ? (
                <p className="mt-2 text-xs text-emerald-400">Current plan</p>
              ) : profile?.tier === 'free' ? (
                <button
                  onClick={() => handleUpgrade('builder')}
                  disabled={billingLoading}
                  className="mt-2 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Upgrade
                </button>
              ) : null}
            </div>

            <div className={`rounded-md border p-4 ${profile?.tier === 'pro' ? 'border-blue-700 bg-blue-900/20' : 'border-zinc-800'}`}>
              <p className="font-medium text-zinc-200">Pro</p>
              <p className="text-sm text-zinc-500">$49/mo &middot; 100,000 calls</p>
              {profile?.tier === 'pro' ? (
                <p className="mt-2 text-xs text-blue-400">Current plan</p>
              ) : profile?.tier !== 'enterprise' ? (
                <button
                  onClick={() => handleUpgrade('pro')}
                  disabled={billingLoading}
                  className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Upgrade
                </button>
              ) : null}
            </div>
          </div>

          {profile?.tier === 'enterprise' && (
            <p className="mt-3 text-sm text-zinc-400">
              Enterprise plan — contact support for changes.
            </p>
          )}
        </div>

        {/* Edit Name */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Display Name</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || name === profile?.name}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-red-900/50 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Delete your account and revoke all API keys. This action cannot be undone.
          </p>

          {showDeleteConfirm ? (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-4">
              <p className="text-sm text-red-300 mb-3">
                Are you sure? All API keys will be revoked immediately.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete my account'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border border-red-800 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-900/20"
            >
              Delete Account
            </button>
          )}
        </div>
      </div>
      <Toast message="Copied to clipboard!" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
