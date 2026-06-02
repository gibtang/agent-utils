import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/auth-user';
import ApiKey from '@/models/ApiKey';
import { successResponse, errorResponse } from '@/lib/response';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();
    const apiKey = await ApiKey.findOne({ _id: id, userId: user._id });
    if (!apiKey) {
      return errorResponse('API key not found', 404);
    }

    apiKey.active = false;
    await apiKey.save();

    return successResponse({ id: apiKey._id, revoked: true });
  } catch (error) {
    console.error('Revoke key error:', error);
    return errorResponse('Failed to revoke API key', 500);
  }
}
