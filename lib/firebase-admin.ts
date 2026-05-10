import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth as _getAuth, Auth } from 'firebase-admin/auth';

let _adminApp: App | null = null;
let _adminAuth: Auth | null = null;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  if (getApps().length > 0) {
    _adminApp = getApps()[0];
    return _adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }

  _adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return _adminApp;
}

export function getAdminAuth(): Auth {
  if (!_adminAuth) {
    _adminAuth = _getAuth(getAdminApp());
  }
  return _adminAuth;
}

// Legacy compat — lazily initialized on first access
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getAdminAuth() as any)[prop];
  },
});
export default new Proxy({} as App, {
  get(_, prop) {
    return (getAdminApp() as any)[prop];
  },
});
