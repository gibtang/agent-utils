import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { type TierName } from '@/lib/pricing';
import { successResponse } from '@/lib/response';
import Notification from '@/models/Notification';
import User from '@/models/User';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notify@agentutils.dev';

// POST /api/notify — Send an email notification
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  await incrementQuota(authResult.apiKey.userId, authResult.apiKey.tier as TierName, authResult.apiKey._id);

  try {
    const body = await request.json();
    const { to, subject, message, priority = 'normal', metadata } = body;

    if (!message) {
      return successResponse({ error: 'Missing required field: message' }, 400);
    }

    await connectDB();

    // If no `to` address provided, fall back to the user's account email
    let recipient = to;
    if (!recipient) {
      const user = await User.findById(authResult.apiKey.userId).select('email').lean();
      if (!user) return successResponse({ error: 'User not found' }, 404);
      recipient = user.email;
    }

    const resolvedSubject = subject || `[AgentUtils] ${priority === 'urgent' ? '🚨 ' : ''}New notification`;

    // Build a simple HTML email
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <div style="margin-bottom:16px">
          <span style="background:${priorityColor(priority)};color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase">${priority}</span>
        </div>
        <p style="font-size:16px;line-height:1.6;color:#111;white-space:pre-wrap">${escapeHtml(message)}</p>
        ${metadata ? `<pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:12px;overflow:auto">${escapeHtml(JSON.stringify(metadata, null, 2))}</pre>` : ''}
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0"/>
        <p style="font-size:12px;color:#71717a">Sent via <a href="https://agentutils.dev" style="color:#71717a">AgentUtils</a> Notification Router</p>
      </div>
    `;

    let status: 'sent' | 'failed' = 'sent';
    let resendId: string | undefined;
    let errorMsg: string | undefined;

    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient,
        subject: resolvedSubject,
        html,
      });

      if (error || !data) {
        status = 'failed';
        errorMsg = error?.message || 'Unknown Resend error';
      } else {
        resendId = data.id;
      }
    } catch (sendError: unknown) {
      status = 'failed';
      errorMsg = sendError instanceof Error ? sendError.message : 'Email send failed';
    }

    // Log every attempt regardless of outcome
    const notification = await Notification.create({
      userId:   authResult.apiKey.userId,
      apiKeyId: authResult.apiKey._id,
      to: recipient,
      subject: resolvedSubject,
      message,
      priority,
      status,
      resendId,
      error: errorMsg,
      metadata,
    });

    if (status === 'failed') {
      return successResponse({
        id: notification._id,
        status: 'failed',
        error: errorMsg,
      }, 502);
    }

    return successResponse({
      id: notification._id,
      status: 'sent',
      to: recipient,
      subject: resolvedSubject,
      priority,
      resendId,
    }, 201);
  } catch (err) {
    console.error('Notify error:', err);
    return successResponse({ error: 'Failed to send notification' }, 500);
  }
}

// GET /api/notify — List notification history
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  await incrementQuota(authResult.apiKey.userId, authResult.apiKey.tier as TierName, authResult.apiKey._id);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter: Record<string, unknown> = { userId: authResult.apiKey.userId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select('-metadata'), // omit metadata in list view
      Notification.countDocuments(filter),
    ]);

    return successResponse({ items, total, limit, offset });
  } catch (err) {
    console.error('Notify list error:', err);
    return successResponse({ error: 'Failed to list notifications' }, 500);
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function priorityColor(priority: string) {
  if (priority === 'urgent') return '#ef4444';
  if (priority === 'normal') return '#3b82f6';
  return '#6b7280';
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
