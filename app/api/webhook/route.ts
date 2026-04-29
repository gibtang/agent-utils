import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { getTierConfig, type TierName } from '@/lib/pricing';
import WebhookInbox from '@/models/WebhookInbox';
import { v4 as uuidv4 } from 'uuid';

// POST /api/webhook — Create a webhook inbox
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  const tier = authResult.apiKey.tier as TierName;
  const tierConfig = getTierConfig(tier);

  if (!tierConfig.features.webhook) {
    return errorResponse('Webhook Inbox requires a paid plan. Upgrade at /profile', 403);
  }

  try {
    const body = await request.json();
    const { label, forwardUrl, ttl } = body;

    await connectDB();

    const userId = authResult.apiKey.userId;
    const apiKeyId = authResult.apiKey._id;

    // Check inbox count limit (skip if unlimited)
    if (tierConfig.webhookMaxInboxes !== -1) {
      const existingCount = await WebhookInbox.countDocuments({ userId });
      if (existingCount >= tierConfig.webhookMaxInboxes) {
        return errorResponse(`Inbox limit reached (${tierConfig.webhookMaxInboxes} on ${tier} tier). Upgrade at /profile`, 429);
      }
    }

    const token = uuidv4();
    const ttlSeconds = ttl || 86400;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const inbox = await WebhookInbox.create({
      userId,
      apiKeyId,
      token,
      label: label || undefined,
      forwardUrl: forwardUrl || undefined,
      expiresAt,
    });

    await incrementQuota(userId, tier, apiKeyId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentutils.dev';

    return successResponse({
      id: inbox._id.toString(),
      token: inbox.token,
      url: `${baseUrl}/hook/${inbox.token}`,
      label: inbox.label,
      expiresAt: inbox.expiresAt,
    }, 201);
  } catch (err) {
    console.error('Webhook inbox create error:', err);
    return errorResponse('Failed to create webhook inbox', 500);
  }
}

// GET /api/webhook — List webhook inboxes
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
      WebhookInbox.find(filter)
        .select('token label messageCount expiresAt')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      WebhookInbox.countDocuments(filter),
    ]);

    return successResponse({
      items: items.map((inbox) => ({
        id: inbox._id.toString(),
        token: inbox.token,
        url: `${baseUrl}/hook/${inbox.token}`,
        label: inbox.label,
        messageCount: inbox.messageCount,
        expiresAt: inbox.expiresAt,
      })),
      total,
    });
  } catch (err) {
    console.error('Webhook inbox list error:', err);
    return errorResponse('Failed to list webhook inboxes', 500);
  }
}
