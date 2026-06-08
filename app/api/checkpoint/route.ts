import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import Checkpoint from '@/models/Checkpoint';

// POST /api/checkpoint — Create a checkpoint (agent sleeps here)
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const body = await request.json();
    const { agentName, taskDescription, state, webhookUrl, ttlHours } = body;

    if (!taskDescription || !state) {
      return successResponse({ error: 'Missing required fields: taskDescription, state' }, 400);
    }

    await connectDB();

    const hours = ttlHours || 24; // Default 24h expiry
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const checkpoint = await Checkpoint.create({
      userId: authResult.apiKey.userId,
      apiKeyId: authResult.apiKey._id,
      agentName: agentName || 'unknown',
      taskDescription,
      state,
      webhookUrl,
      expiresAt,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return successResponse({
      id: checkpoint._id,
      status: checkpoint.status,
      taskDescription: checkpoint.taskDescription,
      expiresAt: checkpoint.expiresAt,
      approvalUrl: `${appUrl}/approve/${checkpoint.publicToken}`,
      // Poll this URL or use webhookUrl for wake-up
      pollUrl: `${appUrl}/api/checkpoint/${checkpoint._id}`,
    }, 201);
  } catch (err) {
    console.error('Checkpoint create error:', err);
    return successResponse({ error: 'Failed to create checkpoint' }, 500);
  }
}

// GET /api/checkpoint — List checkpoints
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter: Record<string, unknown> = { userId: authResult.apiKey.userId };
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      Checkpoint.find(filter)
        .select('-state') // Don't return full state in list
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      Checkpoint.countDocuments(filter),
    ]);

    return successResponse({ items, total, limit, offset });
  } catch (err) {
    console.error('Checkpoint list error:', err);
    return successResponse({ error: 'Failed to list checkpoints' }, 500);
  }
}
