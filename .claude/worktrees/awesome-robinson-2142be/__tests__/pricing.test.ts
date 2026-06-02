import { describe, it, expect } from 'vitest';
import { TIERS, getTierConfig, calculateOverageCost, type TierName } from '@/lib/pricing';

describe('pricing', () => {
  describe('TIERS', () => {
    it('has four tiers: free, builder, pro, enterprise', () => {
      expect(Object.keys(TIERS)).toEqual(['free', 'builder', 'pro', 'enterprise']);
    });

    it('free tier is $0', () => {
      expect(TIERS.free.price).toBe(0);
    });

    it('builder tier is $19/mo', () => {
      expect(TIERS.builder.price).toBe(19);
    });

    it('pro tier is $49/mo', () => {
      expect(TIERS.pro.price).toBe(49);
    });

    it('enterprise tier is custom pricing (0 base, negotiated)', () => {
      expect(TIERS.enterprise.price).toBe(0);
    });

    it('monthly call quotas are set correctly', () => {
      expect(TIERS.free.callsPerMonth).toBe(500);
      expect(TIERS.builder.callsPerMonth).toBe(10000);
      expect(TIERS.pro.callsPerMonth).toBe(100000);
      expect(TIERS.enterprise.callsPerMonth).toBe(-1); // unlimited
    });

    it('free tier has no overage (hard cap)', () => {
      expect(TIERS.free.overageRate).toBe(0);
    });

    it('builder tier has $0.002/call overage', () => {
      expect(TIERS.builder.overageRate).toBe(0.002);
    });

    it('pro tier has $0.001/call overage', () => {
      expect(TIERS.pro.overageRate).toBe(0.001);
    });

    it('file size limits increase per tier', () => {
      expect(TIERS.free.maxFileSize).toBeLessThan(TIERS.builder.maxFileSize);
      expect(TIERS.builder.maxFileSize).toBeLessThan(TIERS.pro.maxFileSize);
      expect(TIERS.pro.maxFileSize).toBeLessThan(TIERS.enterprise.maxFileSize);
    });

    it('retention hours increase per tier', () => {
      expect(TIERS.free.fileRetentionHours).toBeLessThan(TIERS.builder.fileRetentionHours);
      expect(TIERS.builder.fileRetentionHours).toBeLessThan(TIERS.pro.fileRetentionHours);
      expect(TIERS.pro.fileRetentionHours).toBeLessThan(TIERS.enterprise.fileRetentionHours);
    });
  });

  describe('feature flags', () => {
    it('free tier has notify but not shield or otp', () => {
      expect(TIERS.free.features.notify).toBe(true);
      expect(TIERS.free.features.shield).toBe(false);
      expect(TIERS.free.features.otp).toBe(false);
    });

    it('builder tier has notify but not shield or otp', () => {
      expect(TIERS.builder.features.notify).toBe(true);
      expect(TIERS.builder.features.shield).toBe(false);
      expect(TIERS.builder.features.otp).toBe(false);
    });

    it('pro tier has all features', () => {
      const features = Object.values(TIERS.pro.features);
      expect(features.every(Boolean)).toBe(true);
    });

    it('enterprise tier has all features', () => {
      const features = Object.values(TIERS.enterprise.features);
      expect(features.every(Boolean)).toBe(true);
    });

    it('all tiers have fileHost, dlq, checkpoint, notify', () => {
      const sharedFeatures = ['fileHost', 'dlq', 'checkpoint', 'notify'] as const;
      for (const tier of Object.values(TIERS)) {
        for (const feature of sharedFeatures) {
          expect(tier.features[feature]).toBe(true);
        }
      }
    });
  });

  describe('getTierConfig', () => {
    it('returns correct config for each tier', () => {
      expect(getTierConfig('free')).toBe(TIERS.free);
      expect(getTierConfig('builder')).toBe(TIERS.builder);
      expect(getTierConfig('pro')).toBe(TIERS.pro);
      expect(getTierConfig('enterprise')).toBe(TIERS.enterprise);
    });

    it('throws for invalid tier name', () => {
      expect(() => getTierConfig('invalid' as TierName)).toThrow();
    });
  });

  describe('calculateOverageCost', () => {
    it('returns 0 when usage is within quota', () => {
      expect(calculateOverageCost('free', 300)).toBe(0);
      expect(calculateOverageCost('builder', 5000)).toBe(0);
      expect(calculateOverageCost('pro', 50000)).toBe(0);
    });

    it('returns 0 for free tier overage (hard cap)', () => {
      expect(calculateOverageCost('free', 600)).toBe(0);
    });

    it('calculates overage for builder tier', () => {
      // 2000 calls over 10000 quota at $0.002/call = $4.00
      expect(calculateOverageCost('builder', 12000)).toBeCloseTo(4.0, 2);
    });

    it('calculates overage for pro tier', () => {
      // 5000 calls over 100000 quota at $0.001/call = $5.00
      expect(calculateOverageCost('pro', 105000)).toBeCloseTo(5.0, 2);
    });

    it('returns 0 for enterprise tier (unlimited)', () => {
      expect(calculateOverageCost('enterprise', 999999)).toBe(0);
    });
  });
});
