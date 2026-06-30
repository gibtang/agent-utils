/**
 * AgentUtils — Firebase Admin SDK init (server only).
 *
 * Used to verify Firebase ID tokens sent by authenticated clients (dashboard +
 * auth-sync) and to resolve identity to our internal User/Tenant records.
 *
 * Requires the service-account env vars FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. Initialisation is lazy and
 * cached; callers use getAdminAuth().
 */
import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function buildCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys arrive from env with literal "\n" sequences; restore real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;
  return cert({ projectId, clientEmail, privateKey });
}

let adminAuth: ReturnType<typeof getAuth> | null = null;

/**
 * Initialise (once) and return the Admin Auth instance. Returns null when the
 * service-account env vars are absent (e.g. local dev without admin creds).
 */
export function getAdminAuth(): ReturnType<typeof getAuth> | null {
  if (adminAuth) return adminAuth;
  const credential = buildCredential();
  if (!credential) return null;
  const appName = 'agentutils-admin';
  const app = getApps().some((a) => a.name === appName)
    ? getApp(appName)
    : initializeApp({ credential }, appName);
  adminAuth = getAuth(app);
  return adminAuth;
}
