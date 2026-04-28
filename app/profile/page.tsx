'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePage() {
  const { user, profile, loading, logout, refreshProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSaveName = async () => {
    if (!user || name === profile?.name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-firebase-uid': user.uid,
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

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { getAuth } = await import('firebase/auth');
      await sendPasswordResetEmail(getAuth(), user.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch {
      setError('Failed to send reset email');
    } finally {
      setSendingReset(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'DELETE',
        headers: { 'x-firebase-uid': user.uid },
      });
      const json = await res.json();
      if (json.success) {
        await logout();
        router.push('/');
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const tierColors: Record<string, string> = {
    free: 'text-zinc-400 bg-zinc-800',
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

        {/* Account Info */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
              <p className="text-zinc-200">{user.email}</p>
            </div>

            {/* Tier */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Plan</label>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium border ${tierColors[profile?.tier || 'free'] || tierColors.free}`}>
                {(profile?.tier || 'free').charAt(0).toUpperCase() + (profile?.tier || 'free').slice(1)}
              </span>
            </div>

            {/* Member Since */}
            {profile?.createdAt && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Member Since</label>
                <p className="text-zinc-200">{new Date(profile.createdAt).toLocaleDateString()}</p>
              </div>
            )}

            {/* API Keys */}
            {profile?.keyCount !== undefined && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Active API Keys</label>
                <p className="text-zinc-200">{profile.keyCount}</p>
              </div>
            )}
          </div>
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

        {/* Password Reset */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Password</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Send a password reset link to your email address.
          </p>
          <button
            onClick={handlePasswordReset}
            disabled={sendingReset}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {sendingReset ? 'Sending...' : resetSent ? 'Reset email sent!' : 'Send Reset Link'}
          </button>
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
    </div>
  );
}
