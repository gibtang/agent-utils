import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getTierConfig, type TierName } from '@/lib/pricing';
import AgentForm from '@/models/AgentForm';
import { v4 as uuidv4 } from 'uuid';

const VALID_FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'checkbox'];

// POST /api/form — Create a form
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  const tier = authResult.apiKey.tier as TierName;
  const tierConfig = getTierConfig(tier);

  if (!tierConfig.features.form) {
    return errorResponse('Agent Form requires a paid plan. Upgrade at /profile', 403);
  }

  try {
    const body = await request.json();
    const { title, fields, webhookUrl, ttl } = body;

    // Validate title
    if (!title || typeof title !== 'string') {
      return errorResponse('title is required and must be a string', 400);
    }

    // Validate fields
    if (!Array.isArray(fields) || fields.length === 0) {
      return errorResponse('fields must be a non-empty array', 400);
    }

    for (const field of fields) {
      if (!field.name || typeof field.name !== 'string') {
        return errorResponse('Each field must have a name', 400);
      }
      if (!field.label || typeof field.label !== 'string') {
        return errorResponse('Each field must have a label', 400);
      }
      if (!field.type || !VALID_FIELD_TYPES.includes(field.type)) {
        return errorResponse(`Field type must be one of: ${VALID_FIELD_TYPES.join(', ')}`, 400);
      }
    }

    // Validate webhookUrl
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return errorResponse('webhookUrl is required and must be a string', 400);
    }

    await connectDB();

    const userId = authResult.apiKey.userId;
    const apiKeyId = authResult.apiKey._id;

    // Check form count limit (skip if unlimited)
    if (tierConfig.formMaxForms !== -1) {
      const existingCount = await AgentForm.countDocuments({ userId });
      if (existingCount >= tierConfig.formMaxForms) {
        return errorResponse(`Form limit reached (${tierConfig.formMaxForms} on ${tier} tier). Upgrade at /profile`, 429);
      }
    }

    const token = uuidv4();
    const ttlSeconds = ttl || 604800; // default 7 days
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const form = await AgentForm.create({
      userId,
      apiKeyId,
      token,
      title,
      fields,
      webhookUrl,
      expiresAt,
    });

    await incrementQuota(userId, tier, apiKeyId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentutils.dev';

    return successResponse({
      id: form._id.toString(),
      token: form.token,
      url: `${baseUrl}/f/${form.token}`,
      title: form.title,
      status: form.status,
    }, 201);
  } catch (err) {
    console.error('Form create error:', err);
    return errorResponse('Failed to create form', 500);
  }
}

// GET /api/form — List forms
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter = { userId: authResult.apiKey.userId };
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentutils.dev';

    const [items, total] = await Promise.all([
      AgentForm.find(filter)
        .select('token title status responseCount expiresAt')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      AgentForm.countDocuments(filter),
    ]);

    return successResponse({
      items: items.map((form) => ({
        id: form._id.toString(),
        title: form.title,
        status: form.status,
        responseCount: form.responseCount,
        url: `${baseUrl}/f/${form.token}`,
        expiresAt: form.expiresAt,
      })),
      total,
    });
  } catch (err) {
    console.error('Form list error:', err);
    return errorResponse('Failed to list forms', 500);
  }
}
