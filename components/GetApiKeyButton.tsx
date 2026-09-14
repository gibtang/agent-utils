'use client';

/**
 * GetApiKeyButton — auth-aware "Get API Key" link.
 *
 * Renders the same visible button (children + className) at every call site,
 * but routes to /dashboard when signed in and /login when signed out. Defaults
 * to /login while the auth state is still loading; /login redirects to
 * /dashboard for already-authenticated users, so no dead end is possible.
 *
 * Replaces the old hardcoded /docs/v2 links across the marketing surfaces.
 */
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { trackEvent } from '@/lib/analytics';

export default function GetApiKeyButton({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof Link>, 'href' | 'children' | 'className'>) {
  const { user } = useAuth();
  const href = user ? '/dashboard' : '/login';
  return (
    <Link
      href={href}
      className={className}
      {...rest}
      onClick={(event) => {
        trackEvent('onboarding_started', { destination: href === '/dashboard' ? 'dashboard' : 'login' });
        rest.onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
