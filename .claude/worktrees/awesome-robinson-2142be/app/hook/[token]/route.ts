import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WebhookInbox from '@/models/WebhookInbox';
import WebhookMessage from '@/models/WebhookMessage';

async function handleIncoming(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    await connectDB();

    const inbox = await WebhookInbox.findOne({ token }).lean();
    if (!inbox) {
      return NextResponse.json({ error: 'Inbox not found', url: process.env.NEXT_PUBLIC_APP_URL }, { status: 404 });
    }

    // Parse body
    let body: unknown = null;
    const contentType = request.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        body = await request.json();
      } else {
        body = await request.text();
      }
    } catch {
      body = null;
    }

    // Parse headers (sanitize sensitive ones)
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!['authorization', 'cookie', 'x-api-key'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => { query[key] = value; });

    // Get source IP
    const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';

    // Store message
    await WebhookMessage.create({
      inboxId: inbox._id,
      method: request.method,
      headers,
      body,
      query,
      sourceIp,
      contentType,
    });

    // Increment message count atomically
    await WebhookInbox.updateOne({ _id: inbox._id }, { $inc: { messageCount: 1 } });

    // Forward if forwardUrl is set (fire-and-forget)
    if (inbox.forwardUrl) {
      fetch(inbox.forwardUrl, {
        method: request.method,
        headers: { 'Content-Type': contentType || 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }).catch(() => {}); // Ignore forwarding errors
    }

    return NextResponse.json({ received: true, url: process.env.NEXT_PUBLIC_APP_URL });
  } catch (err) {
    console.error('Webhook receive error:', err);
    return NextResponse.json({ error: 'Internal server error', url: process.env.NEXT_PUBLIC_APP_URL }, { status: 500 });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleIncoming(request, ctx);
}
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleIncoming(request, ctx);
}
export async function PUT(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleIncoming(request, ctx);
}
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleIncoming(request, ctx);
}
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handleIncoming(request, ctx);
}
