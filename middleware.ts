import { NextRequest, NextResponse } from 'next/server';

// Public paths that don't require auth
const publicPaths = ['/', '/pricing', '/api/webhooks', '/api/auth', '/api/health', '/docs', '/llms.txt', '/hook', '/f', '/login', '/signup', '/api/firebase-config', '/api/user'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
  ],
};
