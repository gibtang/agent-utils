import { describe, it, expect } from 'vitest';
import { TIERS, getTierConfig, type TierName } from '@/lib/pricing';

describe('pricing', () => {
  describe('TIERS', () => {
    it('has three tiers: free, pro, enterprise', () => {
      expect(Object.keys(TIERS)).toEqual(['free', 'pro', 'enterprise']);
    });

    it('free tier is $0', () => {
      expect(TIERS.free.price).toBe(0);
    });

    it('pro tier is $29', () => {
      expect(TIERS.pro.price).toBe(29);
    });

    it('enterprise tier is $99', () => {
      expect(TIERS.enterprise.price).toBe(99);
    });

    it('rate limits increase per tier', () => {
      expect(TIERS.free.requestsPerDay).toBe(100);
      expect(TIERS.pro.requestsPerDay).toBe(10000);
      expect(TIERS.enterprise.requestsPerDay).toBe(-1); // unlimited
    });

    it('file size limits increase per tier', () => {
      expect(TIERS.free.maxFileSize).toBeLessThan(TIERS.pro.maxFileSize);
      expect(TIERS.pro.maxFileSize).toBeLessThan(TIERS.enterprise.maxFileSize);
    });

    it('retention hours increase per tier', () => {
      expect(TIERS.free.fileRetentionHours).toBeLessThan(TIERS.pro.fileRetentionHours);
      expect(TIERS.pro.fileRetentionHours).toBeLessThan(TIERS.enterprise.fileRetentionHours);
    });
  });

  describe('feature flags', () => {
    it('free tier has notify but not shield or otp', () => {
      expect(TIERS.free.features.notify).toBe(true);
      expect(TIERS.free.features.shield).toBe(false);
      expect(TIERS.free.features.otp).toBe(false);
    });

    it('pro tier has all features', () => {
      const features = Object.values(TIERS.pro.features);
      expect(features.every(Boolean)).toBe(true);
    });

    it('enterprise tier has all features', () => {
      const features = Object.values(TIERS.enterprise.features);
      expect(features.every(Boolean)).toBe(true);
    });

    it('all tiers have fileHost, jsonCleaner, dlq, checkpoint, notify', () => {
      const sharedFeatures = ['fileHost', 'jsonCleaner', 'dlq', 'checkpoint', 'notify'] as const;
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
      expect(getTierConfig('pro')).toBe(TIERS.pro);
      expect(getTierConfig('enterprise')).toBe(TIERS.enterprise);
    });

    it('throws for invalid tier name (TypeScript prevents at compile time)', () => {
      // Runtime safety check
      expect(() => getTierConfig('invalid' as TierName)).toThrow();
    });
  });
});
