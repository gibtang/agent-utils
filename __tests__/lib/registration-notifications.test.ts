import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  renderWelcomeEmailHtml,
  sendTelegramRegistrationAlert,
} from '@/lib/registration-notifications';

const originalToken = process.env.TELEGRAM_REGISTRATION_BOT_TOKEN;
const originalChatId = process.env.TELEGRAM_REGISTRATION_CHAT_ID;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.TELEGRAM_REGISTRATION_BOT_TOKEN;
  else process.env.TELEGRAM_REGISTRATION_BOT_TOKEN = originalToken;
  if (originalChatId === undefined) delete process.env.TELEGRAM_REGISTRATION_CHAT_ID;
  else process.env.TELEGRAM_REGISTRATION_CHAT_ID = originalChatId;
});

describe('registration notifications', () => {
  it('renders a welcome email without interpolating unsafe display names', () => {
    const html = renderWelcomeEmailHtml({
      email: 'new@example.com',
      tenantId: 'ten_123',
      source: 'firebase',
      name: '<new user>',
    });
    expect(html).toContain('Welcome to AgentUtils');
    expect(html).toContain('Hi &lt;new user&gt;,');
    expect(html).not.toContain('Hi <new user>,');
  });

  it('does not call Telegram when its server-only configuration is absent', async () => {
    delete process.env.TELEGRAM_REGISTRATION_BOT_TOKEN;
    delete process.env.TELEGRAM_REGISTRATION_CHAT_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendTelegramRegistrationAlert({
      email: 'new@example.com', tenantId: 'ten_123', source: 'firebase',
    })).resolves.toMatchObject({ ok: false, error: 'NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a free-registration alert to the configured Telegram chat', async () => {
    process.env.TELEGRAM_REGISTRATION_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_REGISTRATION_CHAT_ID = 'test-chat';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendTelegramRegistrationAlert({
      email: 'new@example.com', tenantId: 'ten_123', source: 'public_api',
    })).resolves.toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      chat_id: 'test-chat',
      text: 'New free registration\nEmail: new@example.com\nTenant: ten_123\nSource: public_api',
    });
  });
});
