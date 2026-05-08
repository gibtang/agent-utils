import { headers } from 'next/headers';
import { adminAuth } from './firebase-admin';
import connectDB from './mongodb';
import User from '@/models/User';

/**
 * Get authenticated user from Firebase ID token in Authorization header.
 * Returns the MongoDB user document or null.
 */
export async function getAuthenticatedUser() {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const idToken = authHeader.slice(7);
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (!decodedToken?.uid) return null;

    await connectDB();
    const user = await User.findOne({ firebaseUid: decodedToken.uid, active: true }).lean();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get Firebase UID from Authorization header.
 */
export async function getFirebaseUid(): Promise<string | null> {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const idToken = authHeader.slice(7);
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a session cookie from Firebase ID token.
 * Returns the session cookie string.
 */
export async function createSessionCookie(idToken: string, expiresInMs = 60 * 60 * 1000): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });
}

/**
 * Verify a session cookie and return the decoded claims.
 */
export async function verifySession(sessionCookie: string) {
  return adminAuth.verifySessionCookie(sessionCookie, true);
}
