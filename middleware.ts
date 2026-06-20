import { NextRequest, NextResponse } from 'next/server';

// Public paths that don't require auth
const publicPaths = ['/', '/pricing', '/api/webhooks', '/api/auth', '/api/health', '/docs', '/llms.txt', '/hook', '/f', '/login', '/signup', '/api/firebase-config', '/api/user', '/approve', '/api/checkpoint/public'];

// Canonical hostname. Canonical tags across the site declare the www host,
// so the bare apex domain is 301-redirected here to avoid duplicate-content
// SEO issues. Only the exact apex hostname triggers the redirect; localhost
// and preview hosts are unaffected.
const CANONICAL_HOST = 'www.agent-utils.com';
const APEX_HOST = 'agent-utils.com';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect non-www (apex) -> www (canonical). Uses the Host header, which
  // is the public hostname behind the reverse proxy. Strips any port suffix.
  const rawHost = request.headers.get('host') || '';
  const hostname = rawHost.split(':')[0].toLowerCase();
  if (hostname === APEX_HOST) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.hostname = CANONICAL_HOST;
    return NextResponse.redirect(url, 301);
  }

  // Allow public paths
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // No server-side session cookie check — Firebase Auth manages sessions client-side
  // The AuthContext handles redirecting unauthenticated users
  // Only protect routes that need server-side auth (e.g. admin) here
  return NextResponse.next();
}

export const config = {
  // Match all page routes (so the www redirect can fire site-wide), but skip
  // API routes, static assets, and image optimization files. API routes are
  // excluded so request bodies aren't dropped on method-preserving redirects.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
