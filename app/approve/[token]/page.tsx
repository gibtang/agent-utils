'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CheckpointData {
  id: string;
  status: string;
  taskDescription: string;
  agentName: string;
  expiresAt: string;
  createdAt: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
}

export default function ApprovePage() {
  const params = useParams();
  const token = params.token as string;
  const [checkpoint, setCheckpoint] = useState<CheckpointData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ action: string; reviewedBy: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/checkpoint/public/${token}`);
        const json = await res.json();
        if (json.success) {
          setCheckpoint(json.data);
        } else {
          setError(json.data?.error || 'Not found');
        }
      } catch {
        setError('Failed to load checkpoint');
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const handleAction = async (action: 'approve' | 'reject') => {
    setActing(true);
    setError('');
    try {
      const res = await fetch(`/api/checkpoint/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note || undefined, reviewerName: reviewerName || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setResult({ action, reviewedBy: json.data.reviewedBy });
      } else {
        setError(json.data?.error || 'Action failed');
      }
    } catch {
      setError('Request failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (error && !checkpoint) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
        <div className="text-4xl">🔍</div>
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="text-zinc-400 text-sm">{error}</p>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back to AgentUtils
        </Link>
      </div>
    );
  }

  if (!checkpoint) return null;

  const isExpired = checkpoint.status === 'expired' || new Date(checkpoint.expiresAt) < new Date();
  const isResolved = checkpoint.status === 'approved' || checkpoint.status === 'rejected';
  const expiresIn = () => {
    const diff = new Date(checkpoint.expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          AgentUtils
        </Link>
        <span className="text-xs text-zinc-600">Approval Gate</span>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Status badge */}
        <div className="mb-8 flex items-center gap-3">
          {checkpoint.status === 'pending' && !isExpired && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/40 border border-amber-700/50 px-3 py-1 text-sm text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Awaiting review
            </span>
          )}
          {checkpoint.status === 'approved' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 px-3 py-1 text-sm text-emerald-300">
              ✓ Approved
            </span>
          )}
          {checkpoint.status === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/40 border border-red-700/50 px-3 py-1 text-sm text-red-300">
              ✗ Rejected
            </span>
          )}
          {isExpired && checkpoint.status === 'pending' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-sm text-zinc-400">
              Expired
            </span>
          )}
          {checkpoint.status === 'pending' && !isExpired && (
            <span className="text-xs text-zinc-500">Expires in {expiresIn()}</span>
          )}
        </div>

        {/* Agent info */}
        <div className="mb-4 text-sm text-zinc-500">
          Agent: <span className="text-zinc-300">{checkpoint.agentName}</span>
        </div>
        <div className="mb-2 text-sm text-zinc-500">
          Created: <span className="text-zinc-400">{new Date(checkpoint.createdAt).toLocaleString()}</span>
        </div>

        {/* Task description */}
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Action requested</h2>
          <p className="text-lg text-zinc-100 leading-relaxed whitespace-pre-wrap">
            {checkpoint.taskDescription}
          </p>
        </div>

        {/* Review info (if already resolved) */}
        {(isResolved || isExpired) && checkpoint.reviewedBy && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
            <p className="text-zinc-400">
              {checkpoint.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
              <span className="text-zinc-200">{checkpoint.reviewedBy}</span>
              {checkpoint.reviewedAt && (
                <> on {new Date(checkpoint.reviewedAt).toLocaleString()}</>
              )}
            </p>
            {checkpoint.reviewNote && (
              <p className="mt-2 text-zinc-300">&quot;{checkpoint.reviewNote}&quot;</p>
            )}
          </div>
        )}

        {/* Result confirmation */}
        {result && (
          <div className={`mt-6 rounded-lg border p-6 text-center ${
            result.action === 'approve'
              ? 'bg-emerald-950/30 border-emerald-800'
              : 'bg-red-950/30 border-red-800'
          }`}>
            <div className="text-3xl mb-2">{result.action === 'approve' ? '✓' : '✗'}</div>
            <h2 className="text-lg font-semibold">
              {result.action === 'approve' ? 'Approved' : 'Rejected'}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              The agent has been notified{result.reviewedBy ? ` by ${result.reviewedBy}` : ''}.
            </p>
          </div>
        )}

        {/* Action form */}
        {checkpoint.status === 'pending' && !isExpired && !result && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Your name (optional)</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="John"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for approval or rejection..."
                rows={3}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleAction('approve')}
                disabled={acting}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {acting ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={acting}
                className="flex-1 rounded-lg border border-red-700 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-950/50 disabled:opacity-50 transition-colors"
              >
                {acting ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
