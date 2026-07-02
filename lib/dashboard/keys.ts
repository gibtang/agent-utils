/**
 * AgentUtils — dashboard key management domain logic.
 *
 * Server-side, trusted operations invoked AFTER a Firebase ID token has been
 * verified and resolved to {uid, tenantId} (see lib/auth-session). These never
 * trust a client-supplied tenantId — it always comes from the verified session.
 *
 * A "key" in the dashboard maps to a named Agent record (agent key) under the
 * user's hidden tenant. The plaintext is returned exactly once at creation; it
 * is never stored (only its hash). Listing returns masked keys only.
 */
import connectDB from '@/lib/v2/db';
import { hashKey } from '@/lib/v2/crypto';
import { generateAgentKey, generateAdminKey, resourceId } from '@/lib/v2/ids';
import { reserveCountedQuota, releaseCountedQuota } from '@/lib/v2/quota';
import { RESERVED_AGENT_NAMES } from '@/models/v2/Agent';
import Agent from '@/models/v2/Agent';
import ApiCredential from '@/models/v2/ApiCredential';
import Tenant from '@/models/v2/Tenant';
import User from '@/models/v2/User';

/** Same naming rules as POST /v1/agents. */
const NAME_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;

/** An account must always keep at least one active API key. */
const MIN_ACTIVE_KEYS = 1;

export interface ProvisionResult {
  tenantId: string;
  isNewUser: boolean;
  /** Present only when a brand-new key was minted (shown to the user once). */
  newKey?: { agentId: string; apiKey: string };
}

export interface PublicKeyRow {
  agent_id: string;
  created_at: string;
  api_key_masked: string;
}

export interface CreatedKey {
  agent_id: string;
  api_key: string;
}

/**
 * Idempotently provision (or look up) the hidden tenant + User record for a
 * Firebase identity, and mint a first API key on first-ever login. Called from
 * /api/auth/sync on each auth state change — a no-op after the first time.
 */
export async function provisionUser(input: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}): Promise<ProvisionResult> {
  await connectDB();

  const existing = await User.findOne({ firebaseUid: input.uid }).lean();
  if (existing) {
    return { tenantId: existing.tenantId, isNewUser: false };
  }

  // First-time user: create a hidden tenant + link a User record + one key.
  const tenantId = resourceId('ten_');
  const tenantName = `user-${input.uid.slice(0, 12)}`;
  const adminKey = generateAdminKey(); // internal admin key, never exposed to the user

  await Tenant.create({
    tenantId,
    name: tenantName,
    ownerEmail: input.email,
    ownerUid: input.uid,
    plan: 'free',
    status: 'active',
    adminKeyHash: hashKey(adminKey),
    callbackSecret: resourceId('sec_'),
  });
  await ApiCredential.create({
    keyHash: hashKey(adminKey),
    keyPrefix: 'agutil_adm_',
    keyType: 'admin',
    tenantId,
    agentId: null,
    active: true,
  });

  await User.create({
    firebaseUid: input.uid,
    email: input.email,
    displayName: input.displayName,
    photoURL: input.photoURL,
    tenantId,
  });

  // Auto-onboarding: one default key so the user can start immediately.
  const minted = await mintKey(tenantId, 'default');
  // Reflect the onboarding key in the tenant's agent quota counter.
  await Tenant.updateOne({ tenantId }, { $inc: { agentCount: 1 } });
  return {
    tenantId,
    isNewUser: true,
    newKey: { agentId: minted.agent_id, apiKey: minted.api_key },
  };
}

/**
 * Mint a new named agent key under the tenant. Returns the plaintext once.
 * Enforces naming rules + reserved names + the agent quota.
 */
export async function createKey(
  tenantId: string,
  plan: string,
  name: string,
): Promise<CreatedKey> {
  await connectDB();
  const clean = name.trim();
  if (!clean || !NAME_RE.test(clean)) {
    throw validation('name must be 3–32 chars, lowercase alphanumeric/hyphens');
  }
  if (RESERVED_AGENT_NAMES.has(clean)) {
    throw validation('name "shared" is reserved');
  }
  const quota = await reserveCountedQuota(tenantId, plan, 'agentCount', 'agents');
  if (!quota.ok) {
    throw validation('key quota reached for this account');
  }
  try {
    const minted = await mintKey(tenantId, clean);
    return minted;
  } catch (e) {
    // roll back the reservation on duplicate-name / failure
    await releaseCountedQuota(tenantId, 'agentCount');
    const err = e as { code?: number; message?: string };
    if (err.code === 11000 || /E11000|duplicate/i.test(err.message || '')) {
      throw validation('a key with that name already exists');
    }
    throw e;
  }
}

/** Internal key minter — assumes name validation + quota already handled. */
async function mintKey(tenantId: string, agentId: string): Promise<CreatedKey> {
  const fullKey = generateAgentKey();
  const keyHash = hashKey(fullKey);
  await Agent.create({ agentId, tenantId, apiKeyHash: keyHash });
  await ApiCredential.create({
    keyHash,
    keyPrefix: 'agutil_agt_',
    keyType: 'agent',
    tenantId,
    agentId,
    active: true,
  });
  return { agent_id: agentId, api_key: fullKey };
}

/**
 * List the user's keys (masked). Plaintext is never returned here.
 */
export async function listKeys(tenantId: string): Promise<PublicKeyRow[]> {
  await connectDB();
  const agents = await Agent.find({ tenantId }).sort({ createdAt: 1 }).lean();
  return agents.map((a) => ({
    agent_id: a.agentId,
    created_at: a.createdAt.toISOString(),
    api_key_masked: 'agutil_agt_••••••••••••',
  }));
}

/**
 * Delete (deactivate) a key by name. The credential is deactivated (not
 * deleted) so historical lookups remain consistent; the Agent record is removed.
 *
 * Refuses to remove the account's last remaining key — an API key is required
 * to use the product, so the user must create a replacement key first.
 */
export async function deleteKey(tenantId: string, agentId: string): Promise<boolean> {
  await connectDB();
  const agent = await Agent.findOne({ tenantId, agentId }).lean();
  if (!agent) return false;
  // An account must always keep at least one active key. Count the current
  // named keys (one Agent row = one key) and block deletion when this is it.
  const activeCount = await Agent.countDocuments({ tenantId });
  if (activeCount <= MIN_ACTIVE_KEYS) {
    throw validation(
      'You must keep at least one API key. Create another key before deleting this one.',
    );
  }
  await ApiCredential.updateMany(
    { tenantId, agentId, keyType: 'agent' },
    { $set: { active: false } },
  );
  await Agent.deleteOne({ tenantId, agentId });
  await releaseCountedQuota(tenantId, 'agentCount');
  return true;
}

/** Thrown as a signal the route layer translates into a 400 validation error. */
export class ValidationError extends Error {}

function validation(msg: string): ValidationError {
  return new ValidationError(msg);
}
