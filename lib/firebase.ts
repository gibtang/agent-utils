import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

/**
 * Firebase Configuration
 *
 * Singleton initialization pattern to prevent multiple init in Next.js.
 * Prefer client-side build-time config so auth still works if the API route
 * is unavailable, then fall back to the runtime config endpoint.
 */

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let initialized = false;

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function getBuildTimeFirebaseConfig(): FirebaseConfig | null {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.values(firebaseConfig).some((value) => !value);
  return missing ? null : (firebaseConfig as FirebaseConfig);
}

async function fetchRuntimeFirebaseConfig(): Promise<FirebaseConfig> {
  const response = await fetch('/api/firebase-config');
  if (!response.ok) {
    throw new Error('Failed to fetch Firebase configuration');
  }

  return response.json();
}

async function initializeFirebase(): Promise<{ auth: Auth | null; app: FirebaseApp | null }> {
  if (initialized) return { auth, app };

  if (typeof window !== 'undefined' && !app) {
    try {
      const firebaseConfig = getBuildTimeFirebaseConfig() ?? await fetchRuntimeFirebaseConfig();

      // Initialize or get existing app
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      auth = getAuth(app);
      initialized = true;
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  return { auth, app };
}

const firebaseInitializationPromise = initializeFirebase();

export { firebaseInitializationPromise };
