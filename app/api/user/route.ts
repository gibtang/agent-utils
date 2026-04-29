import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse, errorResponse } from '@/lib/response';
import { getAuthenticatedUser } from '@/lib/auth-user';
import User from '@/models/User';
import ApiKey from '@/models/ApiKey';

/**
 * POST /api/user — Upsert user after Kinde auth
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kindeId, email, name } = body;

    if (!kindeId || !email) {
      return errorResponse('kindeId and email are required', 400);
    }

    await connectDB();

    const existing = await User.findOne({ kindeId }).lean();

    if (existing) {
      // Update email if changed
      const updates: Record<string, string> = {};
      if (existing.email !== email) updates.email = email;
      if (name && existing.name !== name) updates.name = name;
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ kindeId }, updates);
      }
      return successResponse({ user: { ...existing, ...updates }, isNew: false });
    }

    const user = await User.create({ kindeId, email, name: name || '' });
    return successResponse({ user, isNew: true }, 201);
  } catch (error) {
    console.error('User upsert error:', error);
    return errorResponse('Failed to create user', 500);
  }
}

/**
 * GET /api/user — Get current user profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

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
    const user = await getAuthenticatedUser();
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
      { kindeId: user.kindeId, active: true },
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
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    const fullUser = await User.findOne({ kindeId: user.kindeId, active: true });
    if (!fullUser) {
      return errorResponse('User not found', 404);
    }

    fullUser.active = false;
    await fullUser.save();

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
