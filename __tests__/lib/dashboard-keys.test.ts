/**
 * Dashboard key-management domain logic — DB-backed tests.
 *
 * Covers provisionUser (first-login onboarding + idempotency), listKeys
 * (masked, no plaintext), createKey (naming rules + quota + plaintext-once),
 * and deleteKey (deactivation + agent removal + count decrement).
 *
 * Firebase token verification is NOT tested here (needs real service-account
 * creds); it is isolated in lib/auth-session and the route layer.
 */
import '../helpers/mongodb'; // boot MongoMemoryServer + connect mongoose
import { describe, it, expect } from 'vitest';
import {
  provisionUser,
  listKeys,
  createKey,
  deleteKey,
  ValidationError,
} from '@/lib/dashboard/keys';
import User from '@/models/v2/User';
import Tenant from '@/models/v2/Tenant';
import Agent from '@/models/v2/Agent';
import ApiCredential from '@/models/v2/ApiCredential';

const UID = 'firebase-uid-abc';

// Note: collection cleanup between tests is handled centrally by
// __tests__/helpers/mongodb.ts (its afterEach wipes every collection), so no
// per-test teardown is needed here.

describe('provisionUser', () => {
  it('creates a hidden tenant + User + one default key on first login', async () => {
    const result = await provisionUser({ uid: UID, email: 'a@b.com' });

    expect(result.isNewUser).toBe(true);
    expect(result.tenantId).toMatch(/^ten_/);
    expect(result.newKey?.agentId).toBe('default');
    expect(result.newKey?.apiKey).toMatch(/^agutil_agt_/);

    const user = await User.findOne({ firebaseUid: UID }).lean();
    expect(user?.tenantId).toBe(result.tenantId);

    const tenant = await Tenant.findOne({ tenantId: result.tenantId }).lean();
    expect(tenant?.ownerUid).toBe(UID);
    expect(tenant?.ownerEmail).toBe('a@b.com');
    expect(tenant?.agentCount).toBe(1);

    // The plaintext key is hashed, not stored verbatim.
    const cred = await ApiCredential.findOne({
      tenantId: result.tenantId,
      agentId: 'default',
    }).lean();
    expect(cred?.keyHash).not.toContain('agutil_agt_');
    expect(cred?.active).toBe(true);
  });

  it('is idempotent on repeat syncs (no second key, no new tenant)', async () => {
    const first = await provisionUser({ uid: UID, email: 'a@b.com' });
    const second = await provisionUser({ uid: UID, email: 'a@b.com' });

    expect(second.isNewUser).toBe(false);
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.newKey).toBeUndefined();

    const agents = await Agent.find({ tenantId: first.tenantId }).lean();
    expect(agents.length).toBe(1); // still only the onboarding key
  });
});

describe('listKeys', () => {
  it('returns masked keys (never plaintext)', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    await createKey(tenantId, 'free', 'prod-bot');

    const keys = await listKeys(tenantId);
    expect(keys.length).toBe(2); // default + prod-bot
    for (const k of keys) {
      expect(k.api_key_masked).toContain('•••');
      // The masked prefix is fine; the full secret (prefix + hex) must never leak.
      expect(JSON.stringify(k)).not.toMatch(/agutil_agt_[0-9a-f]{16,}/);
    }
    expect(keys.map((k) => k.agent_id).sort()).toEqual(['default', 'prod-bot']);
  });
});

describe('createKey', () => {
  const provisioned = () => provisionUser({ uid: UID, email: 'a@b.com' });

  it('mints a key and returns the plaintext once', async () => {
    const { tenantId } = await provisioned();
    const created = await createKey(tenantId, 'free', 'worker-1');
    expect(created.agent_id).toBe('worker-1');
    expect(created.api_key).toMatch(/^agutil_agt_/);

    const agent = await Agent.findOne({ tenantId, agentId: 'worker-1' }).lean();
    expect(agent).toBeTruthy();
  });

  it('rejects invalid names', async () => {
    const { tenantId } = await provisioned();
    await expect(createKey(tenantId, 'free', 'UP')).rejects.toBeInstanceOf(ValidationError);
    await expect(createKey(tenantId, 'free', 'has space')).rejects.toBeInstanceOf(ValidationError);
    await expect(createKey(tenantId, 'free', 'shared')).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a duplicate name', async () => {
    const { tenantId } = await provisioned();
    await createKey(tenantId, 'free', 'worker-1');
    await expect(createKey(tenantId, 'free', 'worker-1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('enforces the free-plan agent quota', async () => {
    const { tenantId } = await provisioned();
    // 'default' already exists from onboarding. Fill the rest of the free quota.
    const q = (await import('@/lib/v2/quota')).QUOTAS.free.agents;
    let made = 1; // onboarding key
    for (let i = 0; i < q - 1; i++) {
      await createKey(tenantId, 'free', `key-${i}`);
      made++;
    }
    expect(made).toBe(q);
    await expect(createKey(tenantId, 'free', 'over-limit')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('deleteKey', () => {
  it('deactivates the credential, removes the agent, decrements the count', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    await createKey(tenantId, 'free', 'worker-1');

    const removed = await deleteKey(tenantId, 'worker-1');
    expect(removed).toBe(true);

    const agent = await Agent.findOne({ tenantId, agentId: 'worker-1' }).lean();
    expect(agent).toBeNull();

    const cred = await ApiCredential.findOne({ tenantId, agentId: 'worker-1' }).lean();
    expect(cred?.active).toBe(false); // deactivated, not deleted

    const tenant = await Tenant.findOne({ tenantId }).lean();
    // default + worker-1 created (2), worker-1 deleted (1)
    expect(tenant?.agentCount).toBe(1);
  });

  it('returns false for an unknown key', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    const removed = await deleteKey(tenantId, 'does-not-exist');
    expect(removed).toBe(false);
  });
});
