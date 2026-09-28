import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { PLANS, planFor } from '@/lib/billing/plans';
import Account from '@/models/Account';
import Agent from '@/models/Agent';
import Connection from '@/models/Connection';
import PairingCode from '@/models/PairingCode';

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
  await connectDB();
  await Promise.all([Account.createIndexes(), Agent.createIndexes(), Connection.createIndexes(), PairingCode.createIndexes()]);
});

afterEach(async () => {
  await Promise.all([Account.deleteMany({}), Agent.deleteMany({}), Connection.deleteMany({}), PairingCode.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('account catalogue and persistence models', () => {
  it('exports the exact plan catalogue', () => {
    expect(PLANS).toEqual({
      free: { priceUsd: 0, connections: 1, inboxes: 2, eventsPerMonth: 500, fileBytes: 100 * 1024 ** 2, stateBytes: 1 * 1024 ** 2, eventDays: 7, fileDays: 1, maxFileBytes: 100 * 1024 ** 2 },
      plus: { priceUsd: 19, connections: 3, inboxes: 10, eventsPerMonth: 10_000, fileBytes: 5 * 1024 ** 3, stateBytes: 25 * 1024 ** 2, eventDays: 30, fileDays: 7, maxFileBytes: 1 * 1024 ** 3 },
      pro: { priceUsd: 49, connections: 10, inboxes: 50, eventsPerMonth: 100_000, fileBytes: 25 * 1024 ** 3, stateBytes: 100 * 1024 ** 2, eventDays: 90, fileDays: 30, maxFileBytes: 1 * 1024 ** 3 },
    });
    expect(planFor('plus')).toBe(PLANS.plus);
  });

  it('enforces a unique Firebase owner UID', async () => {
    await Account.create({ ownerUid: 'firebase-owner' });
    await expect(Account.create({ ownerUid: 'firebase-owner' })).rejects.toMatchObject({ code: 11000 });
  });

  it('enforces agent names per account but permits them across accounts', async () => {
    const first = await Account.create({ ownerUid: 'owner-one' });
    const second = await Account.create({ ownerUid: 'owner-two' });
    await Agent.create({ accountId: first.accountId, name: 'Production' });
    await expect(Agent.create({ accountId: first.accountId, name: 'Production' })).rejects.toMatchObject({ code: 11000 });
    await expect(Agent.create({ accountId: second.accountId, name: 'Production' })).resolves.toBeDefined();
  });

  it('enforces a unique connection credential hash', async () => {
    const account = await Account.create({ ownerUid: 'owner' });
    const agent = await Agent.create({ accountId: account.accountId, name: 'Worker' });
    await Connection.create({ accountId: account.accountId, agentId: agent.agentId, credentialHash: 'hash-1', displayPrefix: 'au_conn_abcd' });
    await expect(Connection.create({ accountId: account.accountId, agentId: agent.agentId, credentialHash: 'hash-1', displayPrefix: 'au_conn_efgh' })).rejects.toMatchObject({ code: 11000 });
  });

  it('defines a TTL expiry index for pairing codes', () => {
    expect(PairingCode.schema.indexes()).toContainEqual([{ expiresAt: 1 }, { expireAfterSeconds: 0 }]);
  });

  it('does not retain reset-banned product vocabulary in schemas', () => {
    const banned = /adminKey|apiKey|agutil_|tenant/i;
    for (const model of [Account, Agent, Connection, PairingCode]) {
      expect(JSON.stringify(model.schema)).not.toMatch(banned);
    }
  });
});
