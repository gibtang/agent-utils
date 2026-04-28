import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, errorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import DeadLetter from '@/models/DeadLetter';

// POST /api/dlq/:id/retry — Retry a failed task via webhook
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return errorResponse(authResult);

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

    if (!item.retryWebhook) {
      return successResponse({ error: 'No retry webhook configured for this dead letter' }, 400);
    }

    // Forward the original payload to the retry webhook
    const response = await fetch(item.retryWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deadLetterId: item._id,
        taskType: item.taskType,
        payload: item.payload,
        originalError: item.error,
        retryCount: item.retryCount + 1,
        retriedAt: new Date().toISOString(),
      }),
    });

    // Update the dead letter status
    item.status = 'retried';
    item.retryCount += 1;
    await item.save();

    return successResponse({
      id: item._id,
      status: 'retried',
      retryCount: item.retryCount,
      webhookResponse: {
        status: response.status,
        ok: response.ok,
      },
    });
  } catch (err) {
    console.error('DLQ retry error:', err);
    return successResponse({ error: 'Failed to retry dead letter' }, 500);
  }
}
