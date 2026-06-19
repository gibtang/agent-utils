import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import Checkpoint from '@/models/Checkpoint';

// GET /api/hitl/pending — List checkpoints awaiting human approval.
//
// The Human-in-the-Loop feature is implemented via the /api/checkpoint resource
// (create → poll → resume). This endpoint is a convenience alias for
// GET /api/checkpoint?status=pending so the intuitive /api/hitl/pending path
// resolves with data instead of returning a 404. Supports the same pagination
// query params (limit, offset) as the checkpoint list endpoint.
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter = { userId: authResult.apiKey.userId, status: 'pending' };

    const [items, total] = await Promise.all([
      Checkpoint.find(filter)
        .select('-state') // Don't return full state in the list view
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      Checkpoint.countDocuments(filter),
    ]);

    return successResponse({ items, total, limit, offset });
  } catch (err) {
    console.error('HITL pending list error:', err);
    return successResponse({ error: 'Failed to list pending checkpoints' }, 500);
  }
}
