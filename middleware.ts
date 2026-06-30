import { NextRequest, NextResponse } from 'next/server';

// Public paths that don't require auth. /v1/* is v2 AgentUtils — auth is handled
// inside each route via lib/v2/auth.ts, so the middleware must not gate it.
const publicPaths = ['/', '/pricing', '/api/webhooks', '/api/auth', '/api/health', '/docs', '/llms.txt', '/hook', '/f', '/login', '/signup', '/api/firebase-config', '/api/user', '/approve', '/api/checkpoint/public', '/v1'];

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
    // NextURL inherits the internal container port (e.g. 3000) from the
    // request behind the reverse proxy. Setting host/hostname does not clear
    // it, which would leak :3000 into the Location header and redirect users
    // to an unreachable URL. Explicitly drop the port.
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // --- Auth-aware routing (Firebase sessions are client-side / IndexedDB, so
  // we mirror auth state into a cookie set by AuthProvider). This is a ROUTING
  // HINT only — real authorization happens in each API route via the Firebase
  // Admin SDK (verifyIdToken); a forged cookie just shows an empty dashboard.
  // These checks run BEFORE the public-paths early-return because /login and
  // /signup are public paths we still want to bounce for signed-in users. ---
  const AUTH_COOKIE = '__au_authed';
  const authed = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  // Protect /dashboard: bounce unauthenticated users to /login server-side,
  // so there's no client "Loading…" flash.
  if ((pathname === '/dashboard' || pathname.startsWith('/dashboard/')) && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Bounce already-authenticated users away from the auth pages.
  if ((pathname === '/login' || pathname === '/signup') && authed) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Allow public paths
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

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
