export type TierName = 'free' | 'pro' | 'enterprise';

export interface TierConfig {
  name: string;
  price: number;
  requestsPerDay: number;
  maxFileSize: number; // bytes
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
    requestsPerDay: 100,
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
  pro: {
    name: 'Pro',
    price: 29,
    requestsPerDay: 10000,
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
    price: 99,
    requestsPerDay: -1, // unlimited
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
