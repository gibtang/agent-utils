import { describe, it, expect } from 'vitest';
import { TIERS } from '@/lib/pricing';

describe('KV Store pricing', () => {
  it('all tiers have kv feature flag', () => {
    for (const config of Object.values(TIERS)) {
      expect(config.features.kv).toBe(true);
    }
  });

  it('all tiers have kv limit fields', () => {
    for (const config of Object.values(TIERS)) {
      expect(config).toHaveProperty('kvMaxKeys');
      expect(config).toHaveProperty('kvMaxValueBytes');
    }
  });

  it('free tier has 10 keys limit', () => {
    expect(TIERS.free.kvMaxKeys).toBe(10);
  });

  it('pro tier has 1000 keys limit', () => {
    expect(TIERS.pro.kvMaxKeys).toBe(1000);
  });

  it('enterprise has unlimited keys', () => {
    expect(TIERS.enterprise.kvMaxKeys).toBe(-1);
  });
});
