import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import DeadLetter from '@/models/DeadLetter';

// POST /api/dlq — Capture a failed task
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const body = await request.json();
    const { agentName, taskType, payload, error, errorStack, retryWebhook, tags } = body;

    if (!taskType || !error) {
      return successResponse({ error: 'Missing required fields: taskType, error' }, 400);
    }

    await connectDB();
    const deadLetter = await DeadLetter.create({
      userId: authResult.apiKey.userId,
      apiKeyId: authResult.apiKey._id,
      agentName: agentName || 'unknown',
      taskType,
      payload: payload || {},
      error,
      errorStack,
      retryWebhook,
      tags: tags || [],
    });

    return successResponse({
      id: deadLetter._id,
      status: deadLetter.status,
      createdAt: deadLetter.createdAt,
    }, 201);
  } catch (err) {
    console.error('DLQ capture error:', err);
    return successResponse({ error: 'Failed to capture dead letter' }, 500);
  }
}

// GET /api/dlq — List failures
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const agentName = searchParams.get('agent');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter: Record<string, unknown> = {
      userId: authResult.apiKey.userId,
    };
    if (status) filter.status = status;
    if (agentName) filter.agentName = agentName;

    const [items, total] = await Promise.all([
      DeadLetter.find(filter)
        .select('-payload') // Don't return full payload in list
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      DeadLetter.countDocuments(filter),
    ]);

    return successResponse({
      items,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('DLQ list error:', err);
    return successResponse({ error: 'Failed to list dead letters' }, 500);
  }
}
