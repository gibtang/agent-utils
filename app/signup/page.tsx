'use client';

import { RegisterLink, LoginLink } from '@kinde-oss/kinde-auth-nextjs';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-100">
          Create Account
        </h1>

        <RegisterLink
          postLoginRedirectURL="/dashboard"
          className="flex w-full items-center justify-center rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white transition-colors"
        >
          Sign up with Kinde
        </RegisterLink>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-700" />
          <span className="text-xs text-zinc-500">or</span>
          <div className="h-px flex-1 bg-zinc-700" />
        </div>

        <div className="text-center">
          <LoginLink
            postLoginRedirectURL="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
          >
            Sign in to existing account
          </LoginLink>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Secure authentication powered by Kinde
        </p>
      </div>
    </div>
  );
}
