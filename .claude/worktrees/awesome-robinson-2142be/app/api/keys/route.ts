import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/auth-user';
import ApiKey from '@/models/ApiKey';
import User from '@/models/User';
import { successResponse, errorResponse } from '@/lib/response';

// GET /api/keys — List API keys for a user (requires Firebase token)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const keys = await ApiKey.find({ userId: user._id, active: true })
      .select('-key')
      .sort({ createdAt: -1 });

    return successResponse(keys);
  } catch (error) {
    console.error('List keys error:', error);
    return errorResponse('Failed to list API keys', 500);
  }
}

// POST /api/keys — Create new API key
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return errorResponse('Name is required', 400);
    }

    // Ensure fully connected
    await connectDB();
    const fullUser = await User.findById(user._id);
    if (!fullUser) {
      return errorResponse('User not found', 404);
    }

    // Limit: max 5 keys per user on free tier
    const keyCount = await ApiKey.countDocuments({ userId: fullUser._id, active: true });
    if (keyCount >= 5 && fullUser.tier === 'free') {
      return errorResponse('Maximum 5 API keys on free tier', 400);
    }

    const apiKey = await ApiKey.create({
      userId: fullUser._id,
      name,
      tier: fullUser.tier,
    });

    // Return the full key ONLY on creation
    return successResponse({
      id: apiKey._id,
      name: apiKey.name,
      key: apiKey.key,
      tier: apiKey.tier,
      createdAt: apiKey.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create key error:', error);
    return errorResponse('Failed to create API key', 500);
  }
}
