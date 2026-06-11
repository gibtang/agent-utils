import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

/**
 * Firebase Configuration
 *
 * Singleton initialization pattern to prevent multiple init in Next.js.
 * Configuration is fetched from server-side API endpoint to avoid exposing
 * credentials in client bundle.
 */

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let initialized = false;

async function initializeFirebase(): Promise<{ auth: Auth | null; app: FirebaseApp | null }> {
  if (initialized) return { auth, app };

  if (typeof window !== 'undefined' && !app) {
    try {
      const response = await fetch('/api/firebase-config');
      if (!response.ok) {
        throw new Error('Failed to fetch Firebase configuration');
      }
      const firebaseConfig = await response.json();

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
