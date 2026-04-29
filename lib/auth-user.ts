import { NextRequest } from 'next/server';
import { verifyIdToken } from './firebase-admin';
import connectDB from './mongodb';
import User from '@/models/User';

export async function getAuthenticatedUser(request: NextRequest) {
  // Try Bearer token first (verified via Firebase Admin)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { uid } = await verifyIdToken(token);
    await connectDB();
    const user = await User.findOne({ firebaseUid: uid, active: true }).lean();
    return user;
  }

  // Fallback: x-firebase-uid header (legacy, less secure — for backward compatibility during migration)
  const firebaseUid = request.headers.get('x-firebase-uid');
  if (firebaseUid) {
    await connectDB();
    const user = await User.findOne({ firebaseUid, active: true }).lean();
    return user;
  }

  return null;
}
