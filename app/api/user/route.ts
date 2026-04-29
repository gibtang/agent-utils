import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse, errorResponse } from '@/lib/response';
import { getAuthenticatedUser } from '@/lib/auth-user';
import User from '@/models/User';
import ApiKey from '@/models/ApiKey';

/**
 * POST /api/user — Upsert user after Firebase auth
 * Called from client after onAuthStateChanged fires
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firebaseUid, email } = body;

    if (!firebaseUid || !email) {
      return errorResponse('firebaseUid and email are required', 400);
    }

    await connectDB();

    const existing = await User.findOne({ firebaseUid }).lean();

    if (existing) {
      // Update email if changed
      if (existing.email !== email) {
        await User.updateOne({ firebaseUid }, { email });
      }
      return successResponse({ user: { ...existing, email }, isNew: false });
    }

    const user = await User.create({ firebaseUid, email });
    return successResponse({ user, isNew: true }, 201);
  } catch (error) {
    console.error('User upsert error:', error);
    return errorResponse('Failed to create user', 500);
  }
}

/**
 * GET /api/user — Get current user profile
 * Requires Authorization: Bearer <firebase-id-token>
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get key count
    await connectDB();
    const keyCount = await ApiKey.countDocuments({ userId: user._id, active: true });

    return successResponse({
      ...user,
      keyCount,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Failed to get user', 500);
  }
}

/**
 * PATCH /api/user — Update user profile (name only for now)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name } = body;

    if (name !== undefined && typeof name !== 'string') {
      return errorResponse('Name must be a string', 400);
    }

    await connectDB();
    const updated = await User.findOneAndUpdate(
      { firebaseUid: user.firebaseUid, active: true },
      { ...(name !== undefined && { name }) },
      { new: true }
    ).lean();

    if (!updated) {
      return errorResponse('User not found', 404);
    }

    return successResponse(updated);
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse('Failed to update user', 500);
  }
}

/**
 * DELETE /api/user — Deactivate account
 * Revokes all API keys, marks user inactive
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    const fullUser = await User.findOne({ firebaseUid: user.firebaseUid, active: true });
    if (!fullUser) {
      return errorResponse('User not found', 404);
    }

    // Deactivate user
    fullUser.active = false;
    await fullUser.save();

    // Revoke all API keys
    await ApiKey.updateMany(
      { userId: fullUser._id, active: true },
      { active: false }
    );

    return successResponse({ message: 'Account deactivated. All API keys revoked.' });
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse('Failed to delete account', 500);
  }
}
