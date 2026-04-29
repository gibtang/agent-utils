import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import WebhookInbox from '@/models/WebhookInbox';
import WebhookMessage from '@/models/WebhookMessage';

// GET /api/webhook/:id — Get inbox + latest 50 messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const inbox = await WebhookInbox.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    }).lean();

    if (!inbox) {
      return errorResponse('Inbox not found', 404);
    }

    const messages = await WebhookMessage.find({ inboxId: inbox._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentutils.dev';

    return successResponse({
      inbox: {
        id: inbox._id.toString(),
        token: inbox.token,
        url: `${baseUrl}/hook/${inbox.token}`,
        label: inbox.label,
        forwardUrl: inbox.forwardUrl,
        messageCount: inbox.messageCount,
        expiresAt: inbox.expiresAt,
      },
      messages: messages.map((msg) => ({
        id: msg._id.toString(),
        method: msg.method,
        headers: msg.headers,
        body: msg.body,
        query: msg.query,
        sourceIp: msg.sourceIp,
        contentType: msg.contentType,
        createdAt: msg.createdAt,
      })),
    });
  } catch (err) {
    console.error('Webhook inbox get error:', err);
    return errorResponse('Failed to get webhook inbox', 500);
  }
}

// DELETE /api/webhook/:id — Delete inbox + all messages
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { id } = await params;
    await connectDB();

    const inbox = await WebhookInbox.findOne({
      _id: id,
      userId: authResult.apiKey.userId,
    });

    if (!inbox) {
      return errorResponse('Inbox not found', 404);
    }

    await Promise.all([
      WebhookMessage.deleteMany({ inboxId: inbox._id }),
      WebhookInbox.findByIdAndDelete(inbox._id),
    ]);

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('Webhook inbox delete error:', err);
    return errorResponse('Failed to delete webhook inbox', 500);
  }
}
