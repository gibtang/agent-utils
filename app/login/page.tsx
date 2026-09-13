'use client';

/**
 * /login — Google sign-in only.
 *
 * Redirects to /dashboard when already authenticated. The AuthProvider's
 * onAuthStateChanged handles account provisioning; the redirect-after-auth
 * effect here is routing only. Email/password sign-up surfaces were removed
 * with the product reset — Google is the single auth path.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // Redirect (if any) is handled by the auth-state effect above.
    } catch (err) {
      setError(humanizeAuthError(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold tracking-tight text-on-surface">
          Welcome back
        </h1>
        <p className="mt-2 text-center text-sm text-on-surface-variant">
          Sign in to manage your agents
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
        >
          <GoogleIcon /> Continue with Google
        </button>

        {error && (
          <p className="mt-6 rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-on-surface-variant">
          By continuing you agree to our{' '}
          <Link href="/terms" className="font-medium text-primary-fixed-dim hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-medium text-primary-fixed-dim hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function humanizeAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in popup. Allow popups and try again.';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized for sign-in.';
  return 'Something went wrong. Please try again.';
}
