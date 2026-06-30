/**
 * AgentUtils — Firebase client SDK init (browser only).
 *
 * Initialises the Firebase app + Auth from NEXT_PUBLIC_ env vars. SSR-guarded:
 * this module must only initialise in the browser (Firebase Auth relies on
 * browser APIs). Config is read from public env vars directly — they are safe
 * to ship in the client bundle by design.
 */
import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when the required client config is present (all pages can read this). */
export const hasFirebaseClientConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain,
);

let app: ReturnType<typeof getApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

/**
 * Initialise (once) and return the Firebase Auth instance. Returns null outside
 * the browser or when config is missing — callers must null-check.
 */
export function getFirebaseAuth(): ReturnType<typeof getAuth> | null {
  if (typeof window === 'undefined') return null;
  if (!hasFirebaseClientConfig) return null;
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}
