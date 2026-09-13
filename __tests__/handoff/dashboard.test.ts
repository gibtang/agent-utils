import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose'; import { MongoMemoryServer } from 'mongodb-memory-server';
vi.mock('@/lib/firebase/verify', () => ({ verifyFirebaseIdToken: vi.fn(), hasTokenVerificationConfig: true }));
import { verifyFirebaseIdToken } from '@/lib/firebase/verify';
import { connectDB } from '@/lib/core/db'; import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import { createHandoff, submitHandoffValues, listHandoffs, type ConnectionActor } from '@/lib/handoff/service';
import { GET as activityFeed } from '@/app/api/handoffs/[id]/activity/route';
import { GET as ownerList } from '@/app/api/handoffs/route';
import { DELETE as ownerRevoke } from '@/app/api/handoffs/[id]/route';
import Account from '@/models/Account'; import Handoff from '@/models/Handoff'; import Activity from '@/models/Activity'; import RateLimitBucket from '@/models/RateLimitBucket';
let server: MongoMemoryServer; const mockedVerify = vi.mocked(verifyFirebaseIdToken); const now = new Date('2026-01-01T00:00:00Z');
const fields = [{ name: 'email', label: 'Email', type: 'email' as const, required: true }, { name: 'password', label: 'Password', type: 'password' as const, required: true }];
const values = { email: 'person@example.com', password: 'exact secret' };
const req = (url: string, token?: string) => new Request(url, { headers: token ? { authorization: `Bearer ${token}` } : {} }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
let actor: ConnectionActor;
async function submittedHandoff() {
  const made = await createHandoff(actor, { fieldSchema: fields, title: 'Login' }, { now });
  await submitHandoffValues(made.submitToken, values, { now, ipHash: 'ip-hash-dashboard' });
  return made;
}
beforeAll(async () => { server = await MongoMemoryServer.create(); process.env.MONGODB_URI = server.getUri(); resetConfigCacheForTests(); await connectDB(); await Promise.all([Account.createIndexes(), Handoff.createIndexes(), Activity.createIndexes(), RateLimitBucket.createIndexes()]); const account = await provisionAccount({ uid: 'dash-owner', email: null, displayName: null, photoURL: null }); await Account.updateOne({ accountId: account.accountId }, { $set: { plan: 'plus' } }); actor = { accountId: account.accountId, agentId: 'agt_creator', connectionId: 'conn_creator' }; });
afterEach(async () => { vi.clearAllMocks(); await Promise.all([Handoff.deleteMany({}), Activity.deleteMany({}), RateLimitBucket.deleteMany({})]); });
afterAll(async () => { await mongoose.disconnect(); await server.stop(); resetConfigCacheForTests(); });
describe('GET /api/handoffs/[id]/activity', () => {
  it('requires owner authentication', async () => { const made = await submittedHandoff(); const res = await activityFeed(req(`http://localhost/api/handoffs/${made.handoffId}/activity`), ctx(made.handoffId)); expect(res.status).toBe(401); expect((await res.json()).error.code).toBe('authentication_required'); });
  it('returns the event feed metadata-only, oldest first', async () => {
    const made = await submittedHandoff();
    await Activity.create({ accountId: actor.accountId, agentId: actor.agentId, handoffId: made.handoffId, event: 'handoff.submit', metadata: { handoffId: made.handoffId }, createdAt: new Date(now.getTime() + 1000) });
    await Activity.create({ accountId: actor.accountId, handoffId: made.handoffId, event: 'handoff.notify_failed', metadata: { reason: 'http-401' }, createdAt: new Date(now.getTime() + 2000) });
    mockedVerify.mockResolvedValueOnce({ uid: 'dash-owner' });
    const res = await activityFeed(req(`http://localhost/api/handoffs/${made.handoffId}/activity`, 'owner-token'), ctx(made.handoffId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request_id).toMatch(/^req_/);
    expect(body.data).toHaveLength(2);
    expect(body.data.map((row: { event: string }) => row.event)).toEqual(['handoff.submit', 'handoff.notify_failed']);
    for (const row of body.data) expect(Object.keys(row).sort()).toEqual(['createdAt', 'event', 'metadata']);
    expect(body.data[1].metadata).toEqual({ reason: 'http-401' });
    expect(JSON.stringify(body)).not.toMatch(/ciphertext/i);
    expect(JSON.stringify(body)).not.toMatch(/"value"|values|password|person@example/i);
    expect(JSON.stringify(body)).not.toMatch(/token|Hash|ip-hash-dashboard/i);
  });
  // Documented contract: an unknown (or other owner's) handoffId yields an
  // EMPTY 200 list, not 404 — existence of another owner's handoff must not
  // be distinguishable from a mistyped id, and an owner's own handoff with
  // no events yet renders the same way.
  it('returns an empty list for an unknown handoffId (existence-hidden, 200)', async () => {
    mockedVerify.mockResolvedValueOnce({ uid: 'dash-owner' });
    const res = await activityFeed(req('http://localhost/api/handoffs/cv_unknown/activity', 'owner-token'), ctx('cv_unknown'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
describe('owner dashboard surface', () => {
  it('revokes a submitted handoff with crypto-erasure from the DELETE route', async () => {
    const made = await submittedHandoff();
    mockedVerify.mockResolvedValueOnce({ uid: 'dash-owner' });
    const res = await ownerRevoke(req(`http://localhost/api/handoffs/${made.handoffId}`, 'owner-token'), ctx(made.handoffId));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ revoked: true });
    expect(await Handoff.findOne({ handoffId: made.handoffId }).lean()).toMatchObject({ status: 'closed', closureReason: 'revoked', ciphertext: null, iv: null, tag: null, viewTokenHash: null, submitTokenHash: null, submitIpHash: null, callbackSecretHash: null });
    expect(await decryptGone(made.handoffId)).toBe(true);
  });
  it('lists handoffs metadata-only for the owner', async () => {
    const made = await submittedHandoff();
    await Activity.create({ accountId: actor.accountId, handoffId: made.handoffId, event: 'handoff.submit', metadata: { handoffId: made.handoffId } });
    mockedVerify.mockResolvedValueOnce({ uid: 'dash-owner' });
    const res = await ownerList(req('http://localhost/api/handoffs', 'owner-token'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ handoffId: made.handoffId, status: 'submitted', agentId: 'agt_creator', retrievalCount: 0 });
    const flat = JSON.stringify(body);
    expect(flat).not.toMatch(/token|Hash|ciphertext|"iv"|"tag"|fieldSchema|password|person@example|ip-hash-dashboard/i);
    const listed = await listHandoffs({ accountId: actor.accountId });
    expect(JSON.stringify(listed)).not.toMatch(/Token|Hash|ciphertext|"iv"|"tag"/i);
  });
  it('rejects owner surfaces without authentication', async () => { const resList = await ownerList(req('http://localhost/api/handoffs')); expect(resList.status).toBe(401); const resRevoke = await ownerRevoke(req('http://localhost/api/handoffs/cv_x', undefined), ctx('cv_x')); expect(resRevoke.status).toBe(401); });
});
/** Crypto-erasure double-check: no path from the DB document to any secret. */
async function decryptGone(handoffId: string): Promise<boolean> {
  const doc = await Handoff.findOne({ handoffId }).lean();
  return JSON.stringify(doc ?? {}).includes('exact secret') === false && doc?.ciphertext === null;
}
