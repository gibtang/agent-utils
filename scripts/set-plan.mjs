#!/usr/bin/env node
/**
 * One-off tenant plan updater.
 *
 * Flips a Tenant's plan (free → pro, etc.) by owner email or tenantId. Reads
 * MONGODB_URI from the environment — it is never hardcoded or logged.
 *
 * Usage:
 *   MONGODB_URI=... node scripts/set-plan.mjs <email-or-tenantId> [plan] [--apply]
 *
 * Defaults: target plan = "pro", mode = DRY RUN (no writes).
 * Pass --apply to actually persist the change.
 *
 * Run this on the production host (or via `docker exec` into the running app
 * container), where the live MONGODB_URI is already in the environment:
 *
 *   docker exec -it <container> sh -lc \
 *     'node scripts/set-plan.mjs you@example.com pro'
 *   # then, once the dry-run output looks right:
 *   docker exec -it <container> sh -lc \
 *     'node scripts/set-plan.mjs you@example.com pro --apply'
 */
import mongoose from 'mongoose';

const [targetArg, planArg = 'pro', ...rest] = process.argv.slice(2);
const apply = rest.includes('--apply');

if (!targetArg) {
  console.error('Usage: node scripts/set-plan.mjs <email-or-tenantId> [plan] [--apply]');
  process.exit(2);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(2);
}

const PLAN_ENUM = ['free', 'pro'];
if (!PLAN_ENUM.includes(planArg)) {
  console.error(`Invalid plan "${planArg}". Must be one of: ${PLAN_ENUM.join(', ')}`);
  process.exit(2);
}

// Minimal inline schema — avoids importing the app's model registry (which
// would pull in the whole app). Register under the SAME model name as the app
// ('TenantV2') and DO NOT override the collection, so Mongoose derives the
// identical collection name the app uses (it pluralizes the model name).
const TenantSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true },
    name: { type: String },
    ownerEmail: { type: String },
    ownerUid: { type: String },
    plan: { type: String, enum: PLAN_ENUM, default: 'free' },
    status: { type: String, default: 'active' },
  },
);

const isTenantId = /^ten_/.test(targetArg);
const query = isTenantId ? { tenantId: targetArg } : { ownerEmail: targetArg };

async function main() {
  await mongoose.connect(uri, { dbName: 'agent-utils' });
  const Tenant = mongoose.model('TenantV2Script', TenantSchema);

  const tenant = await Tenant.findOne(query).lean();
  if (!tenant) {
    console.error(`No tenant found matching ${JSON.stringify(query)}.`);
    console.error('Tip: this script is case-sensitive on ownerEmail. Check the exact value.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('--- Tenant matched ---');
  console.log(`  tenantId:   ${tenant.tenantId}`);
  console.log(`  name:       ${tenant.name}`);
  console.log(`  ownerEmail: ${tenant.ownerEmail}`);
  console.log(`  status:     ${tenant.status}`);
  console.log(`  plan:       ${tenant.plan}  (current)`);
  console.log('');

  if (tenant.plan === planArg) {
    console.log(`Plan is already "${planArg}". Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`  plan:       ${planArg}  (target)`);
  console.log('');

  if (!apply) {
    console.log('DRY RUN — no changes made. Re-run with --apply to persist:');
    console.log(`  node scripts/set-plan.mjs ${JSON.stringify(targetArg)} ${planArg} --apply`);
    await mongoose.disconnect();
    return;
  }

  const before = tenant.plan;
  const updated = await Tenant.findOneAndUpdate(
    { tenantId: tenant.tenantId },
    { $set: { plan: planArg } },
    { new: true },
  ).lean();

  console.log('--- Applied ---');
  console.log(`  tenantId: ${updated.tenantId}`);
  console.log(`  plan:     ${before} → ${updated.plan}  ✓`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
