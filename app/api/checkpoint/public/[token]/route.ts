import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse } from '@/lib/response';
import Checkpoint from '@/models/Checkpoint';

// GET /api/checkpoint/public/[token] — Get checkpoint by public token (no auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    await connectDB();

    const checkpoint = await Checkpoint.findOne({ publicToken: token })
      .select('_id status taskDescription agentName expiresAt createdAt reviewedBy reviewNote reviewedAt');

    if (!checkpoint) {
      return successResponse({ error: 'Checkpoint not found' }, 404);
    }

    // Auto-expire if past deadline
    if (checkpoint.status === 'pending' && new Date() > checkpoint.expiresAt) {
      checkpoint.status = 'expired';
      await checkpoint.save();
    }

    return successResponse({
      id: checkpoint._id,
      status: checkpoint.status,
      taskDescription: checkpoint.taskDescription,
      agentName: checkpoint.agentName,
      expiresAt: checkpoint.expiresAt,
      createdAt: checkpoint.createdAt,
      reviewedBy: checkpoint.reviewedBy,
      reviewNote: checkpoint.reviewNote,
      reviewedAt: checkpoint.reviewedAt,
    });
  } catch (err) {
    console.error('Public checkpoint get error:', err);
    return successResponse({ error: 'Failed to get checkpoint' }, 500);
  }
}

// POST /api/checkpoint/public/[token] — Approve/reject by public token (no auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { action, note, reviewerName } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return successResponse({ error: 'Action must be "approve" or "reject"' }, 400);
    }

    await connectDB();

    const checkpoint = await Checkpoint.findOne({ publicToken: token });

    if (!checkpoint) {
      return successResponse({ error: 'Checkpoint not found' }, 404);
    }

    if (checkpoint.status !== 'pending') {
      return successResponse({
        error: `Checkpoint already ${checkpoint.status}`,
        currentStatus: checkpoint.status,
      }, 400);
    }

    // Check expiry
    if (new Date() > checkpoint.expiresAt) {
      checkpoint.status = 'expired';
      await checkpoint.save();
      return successResponse({ error: 'Checkpoint has expired' }, 400);
    }

    // Update status
    checkpoint.status = action === 'approve' ? 'approved' : 'rejected';
    checkpoint.reviewNote = note || undefined;
    checkpoint.reviewedBy = reviewerName || 'Anonymous';
    checkpoint.reviewedAt = new Date();
    await checkpoint.save();

    // Fire webhook if configured
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
            reviewedBy: checkpoint.reviewedBy,
            reviewedAt: checkpoint.reviewedAt,
          }),
        });
      } catch (webhookError) {
        console.error('Webhook delivery failed:', webhookError);
      }
    }

    return successResponse({
      id: checkpoint._id,
      status: checkpoint.status,
      reviewedBy: checkpoint.reviewedBy,
      reviewedAt: checkpoint.reviewedAt,
    });
  } catch (err) {
    console.error('Public checkpoint action error:', err);
    return successResponse({ error: 'Failed to update checkpoint' }, 500);
  }
}
