import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { successResponse, errorResponse } from '@/lib/response';
import { getAuthenticatedUser } from '@/lib/auth-user';
import Usage from '@/models/Usage';
import { getTierConfig, type TierName } from '@/lib/pricing';

/**
 * GET /api/billing/usage — Get current billing period usage stats.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const tier = user.tier as TierName;
    const tierConfig = getTierConfig(tier);

    // Determine current period
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (user.billingCycleStart && user.billingCycleEnd && now >= user.billingCycleStart && now <= user.billingCycleEnd) {
      periodStart = user.billingCycleStart;
      periodEnd = user.billingCycleEnd;
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    await connectDB();
    const usage = await Usage.findOne({
      userId: user._id,
      periodStart: { $lte: now },
      periodEnd: { $gte: now },
    }).lean();

    const callsIncluded = usage?.callsIncluded ?? 0;
    const callsOverage = usage?.callsOverage ?? 0;
    const totalCalls = callsIncluded + callsOverage;
    const overageCostCents = usage?.overageCost ?? 0;

    return successResponse({
      tier,
      tierName: tierConfig.name,
      price: tierConfig.price,
      callsIncluded,
      callsOverage,
      totalCalls,
      quota: tierConfig.callsPerMonth, // -1 = unlimited
      overageRate: tierConfig.overageRate,
      overageCostDollars: overageCostCents / 100,
      periodStart,
      periodEnd,
      subscriptionStatus: user.subscriptionStatus || 'none',
    });
  } catch (err) {
    console.error('Usage error:', err);
    return errorResponse('Failed to get usage stats', 500);
  }
}
