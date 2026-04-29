import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
      return adminApp;
    }
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return adminApp;
}

export async function verifyIdToken(idToken: string): Promise<{ uid: string; email?: string }> {
  const auth = getAuth(getAdminApp());
  const decoded = await auth.verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email };
}
