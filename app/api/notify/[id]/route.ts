import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, errorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import Notification from '@/models/Notification';

// GET /api/notify/:id — Fetch a single notification (full detail including metadata)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return errorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const notification = await Notification.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    });

    if (!notification) {
      return successResponse({ error: 'Notification not found' }, 404);
    }

    return successResponse(notification);
  } catch (err) {
    console.error('Notify get error:', err);
    return successResponse({ error: 'Failed to get notification' }, 500);
  }
}
