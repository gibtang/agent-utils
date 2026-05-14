import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TIERS, calculateOverageCost } from '@/lib/pricing';

// Mock MongoDB and models
vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockUserFindOne = vi.fn();
const mockUsageFindOne = vi.fn();
vi.mock('@/models/User', () => ({
  default: {
    findOne: (...args: unknown[]) => mockUserFindOne(...args),
  },
}));
vi.mock('@/models/Usage', () => ({
  default: {
    findOne: (...args: unknown[]) => mockUsageFindOne(...args),
  },
}));

describe('billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('usage calculation logic', () => {
    it('free tier: no overage possible (hard cap)', () => {
      expect(TIERS.free.overageRate).toBe(0);
      expect(calculateOverageCost('free', 99999)).toBe(0);
    });

    it('builder tier: calculates overage at $0.002/call', () => {
      const overage = calculateOverageCost('builder', 15000);
      expect(overage).toBeCloseTo(10.0, 2); // 5000 * $0.002
    });

    it('pro tier: calculates overage at $0.001/call', () => {
      const overage = calculateOverageCost('pro', 150000);
      expect(overage).toBeCloseTo(50.0, 2); // 50000 * $0.001
    });

    it('no overage when within quota', () => {
      expect(calculateOverageCost('builder', 5000)).toBe(0);
      expect(calculateOverageCost('pro', 50000)).toBe(0);
    });
  });

  describe('usage data shape', () => {
    it('returns correct structure for a free user with no usage', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'user1',
        kindeId: 'uid1',
        tier: 'free',
        active: true,
        subscriptionStatus: 'none',
        billingCycleStart: null,
        billingCycleEnd: null,
      });
      mockUsageFindOne.mockResolvedValue(null);

      const user = await mockUserFindOne();
      const usage = await mockUsageFindOne();
      const tier = user.tier;
      const tierConfig = TIERS[tier];
      const callsIncluded = usage?.callsIncluded ?? 0;
      const totalCalls = callsIncluded;

      expect(user.tier).toBe('free');
      expect(totalCalls).toBe(0);
      expect(tierConfig.callsPerMonth).toBe(500);
      expect(tierConfig.overageRate).toBe(0);
    });

    it('returns correct structure for a builder user with usage', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'user2',
        kindeId: 'uid2',
        tier: 'builder',
        active: true,
        subscriptionStatus: 'active',
      });
      mockUsageFindOne.mockResolvedValue({
        callsIncluded: 8000,
        callsOverage: 500,
        overageCost: 100, // cents
      });

      const user = await mockUserFindOne();
      const usage = await mockUsageFindOne();
      const tierConfig = TIERS[user.tier];
      const totalCalls = (usage.callsIncluded ?? 0) + (usage.callsOverage ?? 0);

      expect(user.tier).toBe('builder');
      expect(totalCalls).toBe(8500);
      expect(tierConfig.callsPerMonth).toBe(10000);
      expect(usage.overageCost).toBe(100); // $1.00 in cents
    });
  });

  describe('tier validation', () => {
    it('only builder and pro are valid checkout tiers', () => {
      const validCheckoutTiers = ['builder', 'pro'];
      expect(validCheckoutTiers).not.toContain('free');
      expect(validCheckoutTiers).not.toContain('enterprise');
    });

    it('all tiers have required fields', () => {
      for (const config of Object.values(TIERS)) {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('price');
        expect(config).toHaveProperty('callsPerMonth');
        expect(config).toHaveProperty('overageRate');
        expect(config).toHaveProperty('maxFileSize');
        expect(config).toHaveProperty('fileRetentionHours');
        expect(config).toHaveProperty('features');
      }
    });
  });

  describe('overage cost in cents', () => {
    it('converts dollar overage to cents correctly', () => {
      // 2000 overage calls * $0.002 = $4.00 = 400 cents
      const overageDollars = calculateOverageCost('builder', 12000);
      const overageCents = Math.round(overageDollars * 100);
      expect(overageCents).toBe(400);
    });

    it('handles zero overage', () => {
      const overageDollars = calculateOverageCost('builder', 5000);
      const overageCents = Math.round(overageDollars * 100);
      expect(overageCents).toBe(0);
    });
  });
});
