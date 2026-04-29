export type TierName = 'free' | 'builder' | 'pro' | 'enterprise';

export interface TierConfig {
  name: string;
  price: number;           // monthly subscription ($)
  callsPerMonth: number;   // included calls (-1 = unlimited)
  overageRate: number;     // $ per call beyond quota (0 = hard cap)
  maxFileSize: number;     // bytes
  fileRetentionHours: number;
  features: {
    fileHost: boolean;
    jsonCleaner: boolean;
    dlq: boolean;
    checkpoint: boolean;
    shield: boolean;
    otp: boolean;
    notify: boolean;
  };
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    name: 'Free',
    price: 0,
    callsPerMonth: 500,
    overageRate: 0, // hard cap
    maxFileSize: 5 * 1024 * 1024, // 5MB
    fileRetentionHours: 1,
    features: {
      fileHost: true,
      jsonCleaner: true,
      dlq: true,
      checkpoint: true,
      shield: false,
      otp: false,
      notify: true,
    },
  },
  builder: {
    name: 'Builder',
    price: 19,
    callsPerMonth: 10000,
    overageRate: 0.002,
    maxFileSize: 25 * 1024 * 1024, // 25MB
    fileRetentionHours: 12,
    features: {
      fileHost: true,
      jsonCleaner: true,
      dlq: true,
      checkpoint: true,
      shield: false,
      otp: false,
      notify: true,
    },
  },
  pro: {
    name: 'Pro',
    price: 49,
    callsPerMonth: 100000,
    overageRate: 0.001,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    fileRetentionHours: 24,
    features: {
      fileHost: true,
      jsonCleaner: true,
      dlq: true,
      checkpoint: true,
      shield: true,
      otp: true,
      notify: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 0, // custom pricing
    callsPerMonth: -1, // unlimited
    overageRate: 0,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    fileRetentionHours: 72,
    features: {
      fileHost: true,
      jsonCleaner: true,
      dlq: true,
      checkpoint: true,
      shield: true,
      otp: true,
      notify: true,
    },
  },
};

export function getTierConfig(tier: TierName): TierConfig {
  const config = TIERS[tier];
  if (!config) throw new Error(`Invalid tier: ${tier}`);
  return config;
}

/**
 * Calculate overage cost for a given tier and total monthly usage.
 * Returns the dollar amount owed beyond the included quota.
 */
export function calculateOverageCost(tier: TierName, totalCalls: number): number {
  const config = getTierConfig(tier);

  // No overage for unlimited or hard-capped tiers
  if (config.callsPerMonth === -1 || config.overageRate === 0) {
    return 0;
  }

  const overageCalls = totalCalls - config.callsPerMonth;
  if (overageCalls <= 0) return 0;

  return overageCalls * config.overageRate;
}
