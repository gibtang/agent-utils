/**
 * GET /api/firebase-config — serve the client Firebase config at runtime.
 *
 * Mirrors the check-mcc pattern: rather than relying on NEXT_PUBLIC_* vars being
 * baked into the client bundle, the browser fetches its config here. Validates
 * the required fields and returns 500 if the project isn't configured, so a
 * misconfiguration is loud instead of silently producing a broken auth flow.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId || !config.authDomain) {
    return NextResponse.json(
      { error: 'Firebase client config is incomplete on the server.' },
      { status: 500 },
    );
  }

  return NextResponse.json(config);
}
