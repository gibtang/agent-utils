import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse, errorResponse } from '@/lib/response';
import { getAuthenticatedUser } from '@/lib/auth-user';
import User from '@/models/User';
import ApiKey from '@/models/ApiKey';

/**
 * POST /api/user — Upsert user after Firebase auth
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firebaseUid, email, name } = body;

    if (!firebaseUid || !email) {
      return errorResponse('firebaseUid and email are required', 400);
    }

    await connectDB();

    const existing = await User.findOne({ firebaseUid }).lean();

    if (existing) {
      const updates: Record<string, string> = {};
      if (existing.email !== email) updates.email = email;
      if (name && existing.name !== name) updates.name = name;
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ firebaseUid }, updates);
      }
      // Return default API key — auto-create if missing
      let defaultKey = await ApiKey.findOne({ userId: existing._id, active: true })
        .sort({ createdAt: 1 })
        .select('key')
        .lean();

      if (!defaultKey) {
        const created = await ApiKey.create({ userId: existing._id, name: 'default', tier: existing.tier });
        defaultKey = { key: created.key };
      }

      return successResponse({ user: { ...existing, ...updates }, isNew: false, apiKey: defaultKey.key });
    }

    const user = await User.create({ firebaseUid, email, name: name || '' });

    // Auto-create a default API key for new users
    const apiKey = await ApiKey.create({ userId: user._id, name: 'default', tier: user.tier });

    return successResponse({ user, isNew: true, apiKey: apiKey.key }, 201);
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
    const defaultKey = await ApiKey.findOne({ userId: user._id, active: true })
      .sort({ createdAt: 1 })
      .select('key')
      .lean();

    return successResponse({
      ...user,
      keyCount,
      defaultKey: defaultKey?.key || null,
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

    if (!name || typeof name !== 'string') {
      return errorResponse('Name is required', 400);
    }

    await connectDB();
    await User.updateOne({ _id: user._id }, { name });

    return successResponse({ name });
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse('Failed to update user', 500);
  }
}

/**
 * DELETE /api/user — Delete user account and all associated data
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    // Delete API keys
    await ApiKey.deleteMany({ userId: user._id });

    // Delete user
    await User.deleteOne({ _id: user._id });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse('Failed to delete user', 500);
  }
}
