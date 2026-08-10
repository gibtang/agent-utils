import '../helpers/mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/registration-notifications', () => ({
  notifyFreeRegistration: vi.fn().mockResolvedValue({
    email: { ok: false, error: 'NOT_CONFIGURED' },
    telegram: { ok: false, error: 'NOT_CONFIGURED' },
  }),
}));

import { notifyFreeRegistration } from '@/lib/registration-notifications';
import { provisionUser } from '@/lib/dashboard/keys';
import { POST as createTenant } from '@/app/v1/tenants/route';
import { call } from '../v2/_helpers';

const mockedNotify = vi.mocked(notifyFreeRegistration);

beforeEach(() => vi.clearAllMocks());

describe('free registration notification triggers', () => {
  it('notifies once after first Firebase provisioning, not on later syncs', async () => {
    const input = { uid: 'notification-user-123', email: 'firebase@example.com', displayName: 'Firebase User' };

    await provisionUser(input);
    await provisionUser(input);

    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify).toHaveBeenCalledWith(expect.objectContaining({
      email: input.email,
      source: 'firebase',
      name: input.displayName,
      tenantId: expect.stringMatching(/^ten_/),
    }));
  });

  it('notifies only newly-created public free tenants', async () => {
    const free = await call(createTenant, 'POST', '/v1/tenants', {
      body: { name: 'notify-free', owner_email: 'free@example.com', plan: 'free' },
    });
    expect(free.status).toBe(201);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify).toHaveBeenLastCalledWith(expect.objectContaining({
      email: 'free@example.com',
      source: 'public_api',
      tenantId: free.body.data.tenant_id,
    }));

    const pro = await call(createTenant, 'POST', '/v1/tenants', {
      body: { name: 'notify-pro', owner_email: 'pro@example.com', plan: 'pro' },
    });
    expect(pro.status).toBe(201);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
  });
});
