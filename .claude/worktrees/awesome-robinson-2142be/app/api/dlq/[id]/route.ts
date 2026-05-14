import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import DeadLetter from '@/models/DeadLetter';

// GET /api/dlq/:id — Inspect a single failure (includes full payload)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const item = await DeadLetter.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    });

    if (!item) {
      return successResponse({ error: 'Dead letter not found' }, 404);
    }

    return successResponse(item);
  } catch (err) {
    console.error('DLQ get error:', err);
    return successResponse({ error: 'Failed to get dead letter' }, 500);
  }
}

// DELETE /api/dlq/:id — Dismiss a failure
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const item = await DeadLetter.findOneAndUpdate(
      { _id: id, userId: authResult.apiKey.userId },
      { status: 'dismissed' },
      { new: true }
    );

    if (!item) {
      return successResponse({ error: 'Dead letter not found' }, 404);
    }

    return successResponse({ id: item._id, status: item.status });
  } catch (err) {
    console.error('DLQ dismiss error:', err);
    return successResponse({ error: 'Failed to dismiss dead letter' }, 500);
  }
}
