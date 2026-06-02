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
    dlq: boolean;
    checkpoint: boolean;
    shield: boolean;
    otp: boolean;
    notify: boolean;
    kv: boolean;
    audit: boolean;
    rateLimit: boolean;
    webhook: boolean;
    form: boolean;
  };
  // Tool-specific limits
  kvMaxKeys: number;           // -1 = unlimited
  kvMaxValueBytes: number;     // bytes
  webhookMaxInboxes: number;   // -1 = unlimited
  formMaxForms: number;        // -1 = unlimited
  auditRetentionDays: number;  // -1 = unlimited
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
      dlq: true,
      checkpoint: true,
      shield: false,
      otp: false,
      notify: true,
      kv: true,
      audit: true,
      rateLimit: true,
      webhook: true,
      form: true,
    },
    kvMaxKeys: 10,
    kvMaxValueBytes: 10240, // 10KB
    webhookMaxInboxes: 3,
    formMaxForms: 5,
    auditRetentionDays: 30,
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
      dlq: true,
      checkpoint: true,
      shield: false,
      otp: false,
      notify: true,
      kv: true,
      audit: true,
      rateLimit: true,
      webhook: true,
      form: true,
    },
    kvMaxKeys: 100,
    kvMaxValueBytes: 10240, // 10KB
    webhookMaxInboxes: 10,
    formMaxForms: 25,
    auditRetentionDays: 90,
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
      dlq: true,
      checkpoint: true,
      shield: true,
      otp: true,
      notify: true,
      kv: true,
      audit: true,
      rateLimit: true,
      webhook: true,
      form: true,
    },
    kvMaxKeys: 1000,
    kvMaxValueBytes: 10240, // 10KB
    webhookMaxInboxes: 50,
    formMaxForms: 100,
    auditRetentionDays: 365,
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
      dlq: true,
      checkpoint: true,
      shield: true,
      otp: true,
      notify: true,
      kv: true,
      audit: true,
      rateLimit: true,
      webhook: true,
      form: true,
    },
    kvMaxKeys: -1, // unlimited
    kvMaxValueBytes: 10240, // 10KB
    webhookMaxInboxes: -1, // unlimited
    formMaxForms: -1, // unlimited
    auditRetentionDays: -1, // unlimited
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
