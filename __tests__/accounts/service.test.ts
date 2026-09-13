import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import { provisionAccount } from '@/lib/accounts/service';
import Account from '@/models/Account';
import Agent from '@/models/Agent';
import Connection from '@/models/Connection';

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  resetConfigCacheForTests();
  await connectDB();
  await Account.createIndexes();
});

afterEach(async () => {
  await Promise.all([Account.deleteMany({}), Agent.deleteMany({}), Connection.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  resetConfigCacheForTests();
});

describe('provisionAccount', () => {
  it('creates only an account on first sign-in', async () => {
    const account = await provisionAccount({ uid: 'firebase-user-1', email: 'one@example.com', displayName: 'First User', photoURL: 'https://example.com/photo.png' });

    expect(account).toMatchObject({ ownerUid: 'firebase-user-1', ownerEmail: 'one@example.com', ownerDisplayName: 'First User', ownerPhotoUrl: 'https://example.com/photo.png', plan: 'free' });
    expect(account.accountId).toMatch(/^acct_/);
    expect(await Account.countDocuments()).toBe(1);
    expect(await Agent.countDocuments()).toBe(0);
    expect(await Connection.countDocuments()).toBe(0);
  });

  it('is idempotent and refreshes safe profile fields', async () => {
    const first = await provisionAccount({ uid: 'firebase-user-1', email: 'one@example.com', displayName: 'Old Name', photoURL: 'https://example.com/old.png' });
    const second = await provisionAccount({ uid: 'firebase-user-1', email: 'one@example.com', displayName: 'New Name', photoURL: 'https://example.com/new.png' });

    expect(second.accountId).toBe(first.accountId);
    expect(await Account.countDocuments()).toBe(1);
    await expect(Account.findOne({ ownerUid: 'firebase-user-1' }).lean()).resolves.toMatchObject({ ownerDisplayName: 'New Name', ownerPhotoUrl: 'https://example.com/new.png' });
  });

  it('creates distinct accounts for distinct Firebase UIDs', async () => {
    const first = await provisionAccount({ uid: 'firebase-user-1', email: 'one@example.com', displayName: null, photoURL: null });
    const second = await provisionAccount({ uid: 'firebase-user-2', email: 'two@example.com', displayName: null, photoURL: null });

    expect(second.accountId).not.toBe(first.accountId);
    expect(await Account.countDocuments()).toBe(2);
    expect(first.ownerDisplayName).toBeNull();
    expect(second.ownerPhotoUrl).toBeNull();
  });
});
