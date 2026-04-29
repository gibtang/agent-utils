import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import AuditLog from '@/models/AuditLog';

// POST /api/audit — Log an action
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const body = await request.json();
    const { agentName, action, target, metadata, severity } = body;

    if (!action || typeof action !== 'string') {
      return successResponse({ error: 'Missing required field: action' }, 400);
    }

    await connectDB();
    const auditLog = await AuditLog.create({
      userId: authResult.apiKey.userId,
      apiKeyId: authResult.apiKey._id,
      agentName: agentName || 'unknown',
      action,
      target,
      metadata,
      severity: severity || 'info',
    });

    return successResponse({
      id: auditLog._id,
      createdAt: auditLog.createdAt,
    }, 201);
  } catch (err) {
    console.error('Audit log create error:', err);
    return successResponse({ error: 'Failed to create audit log' }, 500);
  }
}

// GET /api/audit — List logs with filters
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const agent = searchParams.get('agent');
    const action = searchParams.get('action');
    const severity = searchParams.get('severity');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter: Record<string, unknown> = {
      userId: authResult.apiKey.userId,
    };
    if (agent) filter.agentName = agent;
    if (action) filter.action = action;
    if (severity) filter.severity = severity;

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      filter.createdAt = dateFilter;
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return successResponse({
      items,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Audit log list error:', err);
    return successResponse({ error: 'Failed to list audit logs' }, 500);
  }
}
