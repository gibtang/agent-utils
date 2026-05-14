/**
 * Real Resend integration tests — sends actual emails via the Resend API.
 * Requires RESEND_API_KEY in .env.local
 *
 * Uses onboarding@resend.dev (Resend's test domain) → gibtang@gmail.com
 * Restricted API keys can only send to the account email with this domain.
 *
 * Run: npx vitest run __tests__/integration/resend-real.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Resend } from 'resend';

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'onboarding@resend.dev';
const TEST_TO = 'gibtang@gmail.com';

describe.skipIf(!RESEND_KEY)('Resend Real Integration', () => {
  let resend: Resend;

  beforeAll(() => {
    resend = new Resend(RESEND_KEY);
  });

  it('sends a basic HTML email and returns a valid ID', async () => {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_TO,
      subject: '[Integration Test] Basic email',
      html: '<p>Test email from AgentUtils integration test suite.</p>',
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.id).toBeDefined();
  });

  it('sends an email with HTML styling and metadata', async () => {
    const metadata = { runId: 'test-run-abc', steps: 5 };
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <div style="margin-bottom:16px">
          <span style="background:#ef4444;color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase">urgent</span>
        </div>
        <p style="font-size:16px;line-height:1.6;color:#111">Urgent test notification.</p>
        <pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:12px">${JSON.stringify(metadata, null, 2)}</pre>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_TO,
      subject: '[Integration Test] Urgent with metadata',
      html,
    });

    expect(error).toBeNull();
    expect(data!.id).toBeDefined();
  });

  it('rejects an email with invalid recipient', async () => {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: 'not-a-valid-email',
      subject: 'Should fail',
      html: '<p>test</p>',
    });

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
