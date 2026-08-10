/**
 * Registration notifications are deliberately fail-soft: an unavailable email
 * or Telegram provider must never make a completed registration fail.
 *
 * All configuration is read at send time from server-only environment variables:
 * RESEND_API_KEY, RESEND_FROM_EMAIL, TELEGRAM_REGISTRATION_BOT_TOKEN, and
 * TELEGRAM_REGISTRATION_CHAT_ID.
 */
import { sendRawEmail, type ResendSendResult } from '@/lib/v2/email';

export interface RegistrationNotificationInput {
  email: string;
  tenantId: string;
  source: 'firebase' | 'public_api';
  name?: string;
}

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
  status?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderWelcomeEmailHtml(input: RegistrationNotificationInput): string {
  const greeting = input.name?.trim() ? `Hi ${escapeHtml(input.name.trim())},` : 'Hi,';
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;">Welcome to AgentUtils</h2>
  <p>${greeting}</p>
  <p>Your free AgentUtils account is ready. You can now create and manage API keys from your dashboard and start connecting your agents.</p>
  <p style="margin:24px 0;"><a href="https://agent-utils.com/dashboard" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Open dashboard</a></p>
  <p style="font-size:12px;color:#64748b;">If you did not create this account, you can safely ignore this email.</p>
</body></html>`;
}

export async function sendTelegramRegistrationAlert(input: RegistrationNotificationInput): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_REGISTRATION_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_REGISTRATION_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: 'NOT_CONFIGURED' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `New free registration\nEmail: ${input.email}\nTenant: ${input.tenantId}\nSource: ${input.source}`,
      }),
    });
    if (!response.ok) return { ok: false, status: response.status, error: 'TELEGRAM_ERROR' };
    const body = (await response.json()) as { ok?: boolean; description?: string };
    return body.ok ? { ok: true, status: response.status } : { ok: false, status: response.status, error: body.description ?? 'TELEGRAM_ERROR' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'UNKNOWN' };
  }
}

/** Send the welcome email and internal alert concurrently; never throws. */
export async function notifyFreeRegistration(input: RegistrationNotificationInput): Promise<{
  email: ResendSendResult;
  telegram: TelegramSendResult;
}> {
  const [emailResult, telegramResult] = await Promise.allSettled([
    sendRawEmail({
      to: input.email,
      subject: 'Welcome to AgentUtils',
      html: renderWelcomeEmailHtml(input),
    }),
    sendTelegramRegistrationAlert(input),
  ]);
  return {
    email: emailResult.status === 'fulfilled'
      ? emailResult.value
      : { ok: false, error: emailResult.reason instanceof Error ? emailResult.reason.message : 'UNKNOWN' },
    telegram: telegramResult.status === 'fulfilled'
      ? telegramResult.value
      : { ok: false, error: telegramResult.reason instanceof Error ? telegramResult.reason.message : 'UNKNOWN' },
  };
}
