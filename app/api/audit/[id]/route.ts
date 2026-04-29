import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import AuditLog from '@/models/AuditLog';

// GET /api/audit/:id — Get a single audit log entry (read-only, no mutations)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const item = await AuditLog.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    });

    if (!item) {
      return successResponse({ error: 'Audit log not found' }, 404);
    }

    return successResponse(item);
  } catch (err) {
    console.error('Audit log get error:', err);
    return successResponse({ error: 'Failed to get audit log' }, 500);
  }
}
