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
  reacquireKey,
  isLegacyAgent,
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

    // The plaintext key is stored so it can be retrieved later.
    const cred = await ApiCredential.findOne({
      tenantId: result.tenantId,
      agentId: 'default',
    }).lean();
    expect(cred?.apiKey).toContain('agutil_agt_');
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
  it('returns plaintext keys (retrievable)', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    await createKey(tenantId, 'free', 'prod-bot');

    const keys = await listKeys(tenantId);
    expect(keys.length).toBe(2); // default + prod-bot
    for (const k of keys) {
      expect(k.api_key).toMatch(/^agutil_agt_[0-9a-f]{16,}/);
      expect(k.legacy).toBe(false);
    }
    expect(keys.map((k) => k.agent_id).sort()).toEqual(['default', 'prod-bot']);
  });

  it('flags pre-migration Agent docs (no apiKey) as legacy instead of crashing', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    // Simulate a pre-migration doc by writing directly to the collection,
    // bypassing Mongoose schema validation (the old schema required apiKeyHash,
    // not apiKey). This is exactly the shape left in the DB by commit 0e42bda.
    await Agent.collection.insertOne({
      agentId: 'old-bot',
      tenantId,
      apiKeyHash: 'deadbeef'.repeat(8),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const keys = await listKeys(tenantId);
    const legacy = keys.find((k) => k.agent_id === 'old-bot');
    expect(legacy).toBeDefined();
    expect(legacy!.legacy).toBe(true);
    expect(legacy!.api_key).toBe(''); // not undefined — maskKey won't crash
  });
});

describe('reacquireKey', () => {
  it('wipes legacy + fresh keys and mints a single new default', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    await createKey(tenantId, 'free', 'prod-bot');
    // Add a legacy doc directly to the collection (bypasses schema validation,
    // matching what the old code left in the DB).
    await Agent.collection.insertOne({
      agentId: 'old-bot',
      tenantId,
      apiKeyHash: 'deadbeef'.repeat(8),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fresh = await reacquireKey(tenantId);
    expect(fresh.agent_id).toBe('default');
    expect(fresh.api_key).toMatch(/^agutil_agt_[0-9a-f]{16,}/);

    const keys = await listKeys(tenantId);
    expect(keys.length).toBe(1); // everything else wiped
    expect(keys[0].agent_id).toBe('default');
    expect(keys[0].legacy).toBe(false);

    // Tenant quota counter re-synced to the post-wipe state (1).
    const tenant = await Tenant.findOne({ tenantId }).lean();
    expect(tenant?.agentCount).toBe(1);

    // Old agent credentials deactivated, the new one active.
    const creds = await ApiCredential.find({ tenantId, keyType: 'agent' }).lean();
    const active = creds.filter((c) => c.active);
    expect(active.length).toBe(1);
    expect(active[0].agentId).toBe('default');
  });

  it('is idempotent — safe to call on a tenant with no legacy keys', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    const fresh = await reacquireKey(tenantId);
    expect(fresh.agent_id).toBe('default');
    const keys = await listKeys(tenantId);
    expect(keys.length).toBe(1);
    expect(keys[0].legacy).toBe(false);
  });
});

describe('isLegacyAgent', () => {
  it('true when apiKey is missing or empty', () => {
    expect(isLegacyAgent({ apiKey: undefined })).toBe(true);
    expect(isLegacyAgent({ apiKey: '' })).toBe(true);
    expect(isLegacyAgent({ apiKey: 'agutil_agt_abc' })).toBe(false);
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

  it('refuses to delete the last remaining key (account must keep ≥1)', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    // Only the onboarding 'default' key exists.
    await expect(deleteKey(tenantId, 'default')).rejects.toBeInstanceOf(ValidationError);
    // The key must still be present + still active.
    const keys = await listKeys(tenantId);
    expect(keys.length).toBe(1);
    const cred = await ApiCredential.findOne({ tenantId, agentId: 'default' }).lean();
    expect(cred?.active).toBe(true);
  });

  it('allows deleting once a second key exists', async () => {
    const { tenantId } = await provisionUser({ uid: UID, email: 'a@b.com' });
    await createKey(tenantId, 'free', 'worker-1');
    const removed = await deleteKey(tenantId, 'default');
    expect(removed).toBe(true);
    const keys = await listKeys(tenantId);
    expect(keys.map((k) => k.agent_id)).toEqual(['worker-1']);
  });
});
