import { describe, it, expect } from 'vitest';
import { TIERS } from '@/lib/pricing';

describe('Audit Log pricing', () => {
  it('all tiers have audit feature flag', () => {
    for (const config of Object.values(TIERS)) {
      expect(config.features.audit).toBe(true);
    }
  });
  it('all tiers have auditRetentionDays', () => {
    for (const config of Object.values(TIERS)) {
      expect(config).toHaveProperty('auditRetentionDays');
    }
  });
  it('free tier has 30 day retention', () => {
    expect(TIERS.free.auditRetentionDays).toBe(30);
  });
  it('pro tier has 365 day retention', () => {
    expect(TIERS.pro.auditRetentionDays).toBe(365);
  });
  it('enterprise has unlimited retention', () => {
    expect(TIERS.enterprise.auditRetentionDays).toBe(-1);
  });
});
