'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getFriendlyError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('auth/email-already-in-use')) return 'An account with this email already exists.';
    if (message.includes('auth/weak-password')) return 'Password must be at least 6 characters.';
    if (message.includes('auth/invalid-email')) return 'Please enter a valid email address.';
    if (message.includes('auth/network-request-failed')) return 'Network error. Please check your connection.';
    if (message.includes('auth/popup-closed-by-user')) return 'Sign-up popup was closed. Please try again.';
    if (message.includes('Auth not initialized')) return 'Authentication is loading. Please try again in a moment.';
    return 'Something went wrong. Please try again.';
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <Link href="/" className="block text-center mb-6">
          <span className="text-2xl font-bold text-zinc-100">Agent<span className="text-zinc-500">Utils</span></span>
        </Link>

        <h1 className="text-xl font-semibold text-zinc-100 text-center mb-6">Create Account</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 border border-red-800 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 min-h-[44px] text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 min-h-[44px] text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (6+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 pr-10 min-h-[44px] text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[44px] min-h-[44px] text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-zinc-100 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-zinc-900 hover:bg-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-700" />
          <span className="text-xs text-zinc-500">or</span>
          <div className="h-px flex-1 bg-zinc-700" />
        </div>

        <button
          onClick={handleGoogleSignUp}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 min-h-[44px] text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </button>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <a href="/login" className="text-zinc-200 underline hover:text-white min-h-[44px] px-2 inline-flex items-center">Sign in</a>
        </p>
      </div>
    </div>
  );
}
