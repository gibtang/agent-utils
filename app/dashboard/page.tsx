'use client';

/**
 * /dashboard — signed-in owner home (interim shell).
 *
 * Requires authentication: redirects to /login when signed out. The key-
 * management UI was removed with the credential-issuance reset; the agent
 * dashboard (Overview, Inboxes, Settings) lands with the owner-experience
 * cleanup. Until then this page confirms the signed-in identity, surfaces
 * account-sync errors, and offers sign-out.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout, syncError, clearSyncError } = useAuth();

  useEffect(() => {
    // Fallback for the stale-cookie edge case: middleware is the primary gate
    // (it redirects unauthenticated /dashboard hits to /login server-side), but
    // if a lingering cookie let someone through whose Firebase session has
    // since expired, bounce them here once the client confirms no user.
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Dashboard</h1>
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

      {/* Provisioning failure (e.g. server Firebase env not configured) — show
          it prominently so misconfiguration is diagnosable from the UI. */}
      {syncError && (
        <div className="mt-6 rounded-lg border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error">
          <p className="font-semibold">Couldn’t finish setting up your account</p>
          <p className="mt-1 opacity-90">{syncError}</p>
          <button
            onClick={clearSyncError}
            className="mt-2 rounded-md border border-outline-variant px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="mt-10 rounded-lg border border-border-subtle bg-surface-container-lowest px-4 py-8 text-sm text-on-surface-variant">
        <p className="font-medium text-on-surface">Agent tools are on the way</p>
        <p className="mt-2">
          Connect your first agent from its conversation using a Pairing Code —
          the dashboard for agents, inboxes, and usage lands here next.
        </p>
      </section>
    </main>
  );
}
