import { NextRequest, NextResponse } from 'next/server';
import connectDB from './mongodb';
import ApiKey from '@/models/ApiKey';
import User from '@/models/User';
import Usage from '@/models/Usage';
import { getTierConfig, calculateOverageCost, type TierName } from './pricing';

export interface AuthResult {
  success: true;
  apiKey: {
    _id: string;
    userId: string;
    name: string;
    tier: string;
    key: string;
  };
}

export interface AuthError {
  success: false;
  error: string;
  statusCode: number;
}

/**
 * Get the current billing period boundaries for a user.
 * Falls back to calendar month if user has no billing cycle set.
 */
function getCurrentPeriod(user: { billingCycleStart?: Date | null; billingCycleEnd?: Date | null }) {
  const now = new Date();
  if (user.billingCycleStart && user.billingCycleEnd && now >= user.billingCycleStart && now <= user.billingCycleEnd) {
    return { start: user.billingCycleStart, end: user.billingCycleEnd };
  }
  // Default: calendar month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function validateApiKey(request: NextRequest): Promise<AuthResult | AuthError> {
  const key = request.headers.get('x-api-key');

  if (!key) {
    return { success: false, error: 'Missing x-api-key header', statusCode: 401 };
  }

  try {
    await connectDB();
    const apiKey = await ApiKey.findOne({ key, active: true }).lean();

    if (!apiKey) {
      return { success: false, error: 'Invalid API key', statusCode: 401 };
    }

    // Fetch user to get subscription tier and billing cycle
    const user = await User.findById(apiKey.userId).lean();
    if (!user) {
      return { success: false, error: 'User not found', statusCode: 401 };
    }

    // Use user's tier (source of truth) rather than key-level tier
    const tier = user.tier as TierName;
    const tierConfig = getTierConfig(tier);
    const { start: periodStart, end: periodEnd } = getCurrentPeriod(user);

    // Get or create usage record for this period
    const usage = await Usage.findOne({
      userId: user._id,
      periodStart: { $lte: new Date() },
      periodEnd: { $gte: new Date() },
    }).lean();

    const totalCalls = usage ? usage.callsIncluded + usage.callsOverage : 0;

    // Check quota
    if (tierConfig.callsPerMonth !== -1) {
      const isOverQuota = totalCalls >= tierConfig.callsPerMonth;

      if (isOverQuota) {
        // Free tier: hard cap
        if (tierConfig.overageRate === 0) {
          return {
            success: false,
            error: `Monthly quota exceeded (${tierConfig.callsPerMonth.toLocaleString()} calls on ${tier} tier). Upgrade at https://agentutils.dev/profile`,
            statusCode: 429,
          };
        }
        // Builder/Pro: allow overage, will be tracked
      }
    }

    // Determine if this call is overage
    const isOverage = tierConfig.callsPerMonth !== -1 && totalCalls >= tierConfig.callsPerMonth;

    // Update usage record
    const now = new Date();
    if (!usage) {
      await Usage.create({
        userId: user._id,
        periodStart,
        periodEnd,
        callsIncluded: isOverage ? 0 : 1,
        callsOverage: isOverage ? 1 : 0,
        overageCost: 0,
        toolBreakdown: {},
      });
    } else {
      if (isOverage) {
        const newOverage = usage.callsOverage + 1;
        const overageCost = Math.round(calculateOverageCost(tier, usage.callsIncluded + newOverage) * 100);
        await Usage.updateOne(
          { _id: usage._id },
          { $inc: { callsOverage: 1 }, $set: { overageCost } }
        );
      } else {
        await Usage.updateOne(
          { _id: usage._id },
          { $inc: { callsIncluded: 1 } }
        );
      }
    }

    // Update the key's monthly counter
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const update: Record<string, unknown> = { lastUsedAt: now };
    if (!apiKey.monthStartedAt || apiKey.monthStartedAt < monthStart) {
      update.monthlyCount = 1;
      update.monthStartedAt = monthStart;
    } else {
      update.$inc = { monthlyCount: 1 };
    }
    await ApiKey.updateOne({ _id: apiKey._id }, update);

    return {
      success: true,
      apiKey: {
        _id: apiKey._id.toString(),
        userId: apiKey.userId.toString(),
        name: apiKey.name,
        tier,
        key: apiKey.key,
      },
    };
  } catch (error) {
    console.error('Auth error:', error);
    return { success: false, error: 'Internal server error', statusCode: 500 };
  }
}

export function errorResponse(error: AuthError) {
  return NextResponse.json(
    { error: error.error, code: `HTTP_${error.statusCode}` },
    { status: error.statusCode }
  );
}
