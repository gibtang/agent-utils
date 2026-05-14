import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Fetches Firebase config from server API, then initializes Firebase lazily.
 * This avoids build-time env var caching issues — config is always fresh.
 */
export const firebaseInitializationPromise = (async () => {
  if (typeof window === 'undefined') {
    return { auth: null, googleProvider: null };
  }

  // Avoid re-initializing
  if (auth && googleProvider) {
    return { auth, googleProvider };
  }

  try {
    const response = await fetch('/api/firebase-config');
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to fetch config' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    const firebaseConfig: FirebaseConfig = await response.json();

    // Initialize or get existing app
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } catch (err) {
    console.error('Firebase init error:', err);
    // Fall back to build-time config if API fails
    const buildConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    } as FirebaseConfig;

    if (buildConfig.apiKey) {
      app = getApps().length === 0 ? initializeApp(buildConfig) : getApps()[0];
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
    }
  }

  return { auth, googleProvider };
})();