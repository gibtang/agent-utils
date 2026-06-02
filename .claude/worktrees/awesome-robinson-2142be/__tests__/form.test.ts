import { describe, it, expect } from 'vitest';
import { TIERS } from '@/lib/pricing';

describe('Agent Form pricing', () => {
  it('all tiers have form feature flag', () => {
    for (const config of Object.values(TIERS)) {
      expect(config.features.form).toBe(true);
    }
  });
  it('all tiers have formMaxForms', () => {
    for (const config of Object.values(TIERS)) {
      expect(config).toHaveProperty('formMaxForms');
    }
  });
  it('free tier has 5 form limit', () => {
    expect(TIERS.free.formMaxForms).toBe(5);
  });
  it('pro tier has 100 form limit', () => {
    expect(TIERS.pro.formMaxForms).toBe(100);
  });
  it('enterprise has unlimited forms', () => {
    expect(TIERS.enterprise.formMaxForms).toBe(-1);
  });
});
