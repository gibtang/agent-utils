import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import Checkpoint from '@/models/Checkpoint';

// GET /api/checkpoint/:id — Poll checkpoint status (agent checks if approved)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const checkpoint = await Checkpoint.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    });

    if (!checkpoint) {
      return successResponse({ error: 'Checkpoint not found' }, 404);
    }

    // Check if expired
    if (checkpoint.status === 'pending' && new Date() > checkpoint.expiresAt) {
      checkpoint.status = 'expired';
      await checkpoint.save();
    }

    return successResponse({
      id: checkpoint._id,
      status: checkpoint.status,
      taskDescription: checkpoint.taskDescription,
      agentName: checkpoint.agentName,
      reviewNote: checkpoint.reviewNote,
      reviewedAt: checkpoint.reviewedAt,
      expiresAt: checkpoint.expiresAt,
      // Include state only when approved (agent needs it to resume)
      state: checkpoint.status === 'approved' ? checkpoint.state : undefined,
    });
  } catch (err) {
    console.error('Checkpoint get error:', err);
    return successResponse({ error: 'Failed to get checkpoint' }, 500);
  }
}
