/**
 * AgentUtils v2 — email delivery (Resend).
 *
 * Thin, fail-soft wrapper. Resend is the only email provider; RESEND_API_KEY
 * and RESEND_FROM_EMAIL must be set in the deployment environment. A missing
 * key returns `{ ok: false, error: 'NOT_CONFIGURED' }` so callers (the tick
 * engine) can record a failed attempt without throwing — Confession creation
 * never depends on email being available.
 *
 * The SDK is imported lazily inside getResend() so a missing/uninstalled
 * `resend` package (e.g. local dev without the key) does not crash module load.
 */
import type { ConfessionUrgency } from '@/models/v2/Confession';

export interface ResendSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  status?: number;
}

let cachedClient: unknown = null;
let cachedKey = '';

/** Lazily build the Resend client. Returns null if not configured. */
export function getResend(): { client: { emails: { send: (args: unknown) => Promise<unknown> } } } | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (cachedClient && cachedKey === apiKey) {
    return { client: cachedClient as { emails: { send: (args: unknown) => Promise<unknown> } } };
  }
  // Lazy import so the module loads even without `resend` installed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require('resend') as { Resend: new (k: string) => { emails: { send: (args: unknown) => Promise<unknown> } } };
  cachedClient = new Resend(apiKey);
  cachedKey = apiKey;
  return { client: cachedClient };
}

/** Verified sender (`RESEND_FROM_EMAIL`). */
export function fromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'AgentUtils <no-reply@agent-utils.com>';
}

function urgencyLabel(u: ConfessionUrgency): string {
  switch (u) {
    case 'blocking':
      return 'Blocking';
    case 'high':
      return 'High';
    case 'normal':
  }
  return 'Normal';
}

export interface ConfessionEmailInput {
  to: string;
  confessionId: string;
  title: string;
  summary: string | null;
  agentId: string;
  urgency: ConfessionUrgency;
  expiresAt: Date;
  reviewUrl: string; // /c/{id}?t=ct_... — opaque, no sensitive content
  escalationTier: number; // 0 = initial, 1 = escalation reminder
}

/** Render the Confession review email as self-contained HTML. */
export function renderConfessionEmailHtml(input: ConfessionEmailInput): string {
  const expiry = input.expiresAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const heading = input.escalationTier > 0 ? 'Escalation: a Confession is still awaiting your review' : 'A Confession needs your review';
  const sub = input.escalationTier > 0
    ? 'This was not reviewed within the response window and is being escalated to you again.'
    : 'An agent has surfaced an action that requires a human decision.';
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 8px;">${heading}</h2>
  <p style="margin:0 0 20px;color:#475569;">${sub}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#64748b;width:120px;">Title</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(input.title)}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Requesting agent</td><td style="padding:6px 0;">${escapeHtml(input.agentId)}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Urgency</td><td style="padding:6px 0;">${escapeHtml(urgencyLabel(input.urgency))}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Respond by</td><td style="padding:6px 0;">${expiry}</td></tr>
  </table>
  ${input.summary ? `<p style="margin:16px 0;padding:12px;background:#f1f5f9;border-radius:6px;white-space:pre-wrap;">${escapeHtml(input.summary)}</p>` : ''}
  <p style="margin:24px 0;">
    <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Review and respond</a>
  </p>
  <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;">
    This link is private to you, expires after 24 hours, and works only for this Confession. If you did not expect this email, you can safely ignore it.
  </p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ConfessionEmailResult extends ResendSendResult {
  html: string;
  subject: string;
}

/**
 * Send a pre-rendered HTML email. Never throws. Used by the tick engine to
 * send the stable snapshot stored on the NotificationJob (so retries send
 * byte-identical content, including the original embedded reviewer token).
 */
export async function sendRawEmail(args: { to: string; subject: string; html: string }): Promise<ResendSendResult> {
  const r = getResend();
  if (!r) return { ok: false, error: 'NOT_CONFIGURED' };
  try {
    const res = (await r.client.emails.send({
      from: fromEmail(),
      to: args.to,
      subject: args.subject,
      html: args.html,
    })) as { id?: string; error?: { message?: string; name?: string } };
    if (res && typeof res === 'object' && 'error' in res && res.error) {
      return { ok: false, error: res.error.message ?? res.error.name ?? 'RESEND_ERROR' };
    }
    return { ok: true, messageId: (res as { id?: string })?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

/** Send a Confession review email. Never throws; always returns a result. */
export async function sendConfessionEmail(input: ConfessionEmailInput): Promise<ConfessionEmailResult> {
  const subject =
    input.escalationTier > 0
      ? `[Escalated] Review requested: ${input.title}`
      : `Review requested: ${input.title}`;
  const html = renderConfessionEmailHtml(input);

  const r = getResend();
  if (!r) {
    return { ok: false, error: 'NOT_CONFIGURED', html, subject };
  }
  try {
    const res = (await r.client.emails.send({
      from: fromEmail(),
      to: input.to,
      subject,
      html,
    })) as { id?: string; error?: { message?: string; name?: string } };
    if (res && typeof res === 'object' && 'error' in res && res.error) {
      return { ok: false, error: res.error.message ?? res.error.name ?? 'RESEND_ERROR', html, subject };
    }
    return { ok: true, messageId: (res as { id?: string })?.id, html, subject };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN', html, subject };
  }
}
