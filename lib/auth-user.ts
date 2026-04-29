import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import connectDB from './mongodb';
import User from '@/models/User';

export async function getAuthenticatedUser() {
  try {
    const { isAuthenticated, getUser } = getKindeServerSession();
    const authenticated = await isAuthenticated();

    if (!authenticated) return null;

    const kindeUser = await getUser();
    if (!kindeUser?.id) return null;

    await connectDB();
    const user = await User.findOne({ kindeId: kindeUser.id, active: true }).lean();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get Kinde user ID from server session.
 * Use in API routes that need the Kinde ID for user lookup/upsert.
 */
export async function getKindeUserId(): Promise<string | null> {
  try {
    const { isAuthenticated, getUser } = getKindeServerSession();
    const authenticated = await isAuthenticated();
    if (!authenticated) return null;
    const kindeUser = await getUser();
    return kindeUser?.id ?? null;
  } catch {
    return null;
  }
}
