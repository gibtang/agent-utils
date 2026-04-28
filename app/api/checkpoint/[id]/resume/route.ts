import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, errorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import Checkpoint from '@/models/Checkpoint';

// POST /api/checkpoint/:id/resume — Approve or reject (human clicks approve, agent wakes)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return errorResponse(authResult);

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, note } = body; // action: 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return successResponse({ error: 'Action must be "approve" or "reject"' }, 400);
    }

    await connectDB();

    const checkpoint = await Checkpoint.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    });

    if (!checkpoint) {
      return successResponse({ error: 'Checkpoint not found' }, 404);
    }

    if (checkpoint.status !== 'pending') {
      return successResponse({
        error: `Checkpoint already ${checkpoint.status}`,
        currentStatus: checkpoint.status,
      }, 400);
    }

    // Update status
    checkpoint.status = action === 'approve' ? 'approved' : 'rejected';
    checkpoint.reviewNote = note;
    checkpoint.reviewedBy = authResult.apiKey.name;
    checkpoint.reviewedAt = new Date();
    await checkpoint.save();

    // Fire webhook if configured (wake the agent)
    if (checkpoint.webhookUrl) {
      try {
        await fetch(checkpoint.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkpointId: checkpoint._id,
            status: checkpoint.status,
            reviewNote: checkpoint.reviewNote,
            state: checkpoint.status === 'approved' ? checkpoint.state : undefined,
            reviewedAt: checkpoint.reviewedAt,
          }),
        });
      } catch (webhookError) {
        console.error('Webhook delivery failed:', webhookError);
        // Don't fail the request — checkpoint is still updated
      }
    }

    return successResponse({
      id: checkpoint._id,
      status: checkpoint.status,
      reviewedBy: checkpoint.reviewedBy,
      reviewedAt: checkpoint.reviewedAt,
      webhookDelivered: !!checkpoint.webhookUrl,
    });
  } catch (err) {
    console.error('Checkpoint resume error:', err);
    return successResponse({ error: 'Failed to resume checkpoint' }, 500);
  }
}
