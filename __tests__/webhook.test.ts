import { describe, it, expect } from 'vitest';
import { TIERS } from '@/lib/pricing';

describe('Webhook Inbox pricing', () => {
  it('all tiers have webhook feature flag', () => {
    for (const config of Object.values(TIERS)) {
      expect(config.features.webhook).toBe(true);
    }
  });
  it('all tiers have webhookMaxInboxes', () => {
    for (const config of Object.values(TIERS)) {
      expect(config).toHaveProperty('webhookMaxInboxes');
    }
  });
  it('free tier has 3 inbox limit', () => {
    expect(TIERS.free.webhookMaxInboxes).toBe(3);
  });
  it('pro tier has 50 inbox limit', () => {
    expect(TIERS.pro.webhookMaxInboxes).toBe(50);
  });
  it('enterprise has unlimited inboxes', () => {
    expect(TIERS.enterprise.webhookMaxInboxes).toBe(-1);
  });
});
