import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse, errorResponse } from '@/lib/response';
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Missing authorization header', 401);
    }

    // We use Firebase ID token to identify the user
    // The token is verified client-side; here we just need the uid from the body or a separate lookup
    // For simplicity, the client sends firebaseUid in a header
    const firebaseUid = request.headers.get('x-firebase-uid');
    if (!firebaseUid) {
      return errorResponse('Missing x-firebase-uid header', 400);
    }

    await connectDB();
    const user = await User.findOne({ firebaseUid, active: true }).lean();

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Get key count
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
    const firebaseUid = request.headers.get('x-firebase-uid');
    if (!firebaseUid) {
      return errorResponse('Missing x-firebase-uid header', 400);
    }

    const body = await request.json();
    const { name } = body;

    if (name !== undefined && typeof name !== 'string') {
      return errorResponse('Name must be a string', 400);
    }

    await connectDB();
    const user = await User.findOneAndUpdate(
      { firebaseUid, active: true },
      { ...(name !== undefined && { name }) },
      { new: true }
    ).lean();

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return successResponse(user);
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
    const firebaseUid = request.headers.get('x-firebase-uid');
    if (!firebaseUid) {
      return errorResponse('Missing x-firebase-uid header', 400);
    }

    await connectDB();

    const user = await User.findOne({ firebaseUid, active: true });
    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Deactivate user
    user.active = false;
    await user.save();

    // Revoke all API keys
    await ApiKey.updateMany(
      { userId: user._id, active: true },
      { active: false }
    );

    return successResponse({ message: 'Account deactivated. All API keys revoked.' });
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse('Failed to delete account', 500);
  }
}
