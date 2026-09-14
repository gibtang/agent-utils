import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import {
  createAgent,
  createPairingCode,
  listConnections,
  redeemPairingCode,
} from '@/lib/connections/service';
import Account from '@/models/Account';
import Agent from '@/models/Agent';
import Connection from '@/models/Connection';
import PairingCode from '@/models/PairingCode';
import RateLimitBucket from '@/models/RateLimitBucket';

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
  await connectDB();
  await Promise.all([
    Account.createIndexes(),
    Agent.createIndexes(),
    Connection.createIndexes(),
    PairingCode.createIndexes(),
    RateLimitBucket.createIndexes(),
  ]);
});

afterEach(async () => {
  await Promise.all([
    Account.deleteMany({}),
    Agent.deleteMany({}),
    Connection.deleteMany({}),
    PairingCode.deleteMany({}),
    RateLimitBucket.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('owner connection dashboard seam', () => {
  it('lists only the owner connections with safe display fields', async () => {
    const owner = await provisionAccount({ uid: 'owner', email: null, displayName: null, photoURL: null });
    const other = await provisionAccount({ uid: 'other', email: null, displayName: null, photoURL: null });
    const ownerAgent = await createAgent(owner, { name: 'Primary' });
    const otherAgent = await createAgent(other, { name: 'Other' });
    const ownerCode = await createPairingCode(owner, ownerAgent.agentId, {});
    const otherCode = await createPairingCode(other, otherAgent.agentId, {});
    await redeemPairingCode({ code: ownerCode.code });
    await redeemPairingCode({ code: otherCode.code });

    const rows = await listConnections(owner);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ agentId: ownerAgent.agentId, accountId: owner.accountId, status: 'active' });
    expect(rows[0]).not.toHaveProperty('credentialHash');
  });
});
