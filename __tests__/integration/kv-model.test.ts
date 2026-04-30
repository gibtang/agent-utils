import { describe, it, expect } from 'vitest';
import '../helpers/mongodb';
import mongoose from 'mongoose';
import KvEntry from '@/models/KvEntry';

describe('KV Model Integration (MongoDB)', () => {
  const userId = new mongoose.Types.ObjectId();
  const apiKeyId = new mongoose.Types.ObjectId();

  it('creates and reads back a KvEntry', async () => {
    const entry = await KvEntry.create({
      userId,
      apiKeyId,
      key: 'mykey',
      value: { nested: true },
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const found = await KvEntry.findById(entry._id);
    expect(found).toBeDefined();
    expect(found!.key).toBe('mykey');
    expect(found!.value).toEqual({ nested: true });
  });

  it('enforces unique compound index (apiKeyId + key)', async () => {
    await KvEntry.createIndexes();

    await KvEntry.create({
      userId,
      apiKeyId,
      key: 'unique-test',
      value: 'v1',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    await expect(
      KvEntry.create({
        userId,
        apiKeyId,
        key: 'unique-test',
        value: 'v2',
        expiresAt: new Date(Date.now() + 86400_000),
      }),
    ).rejects.toThrow();
  });

  it('allows same key under different apiKeyId', async () => {
    const otherApiKeyId = new mongoose.Types.ObjectId();

    await KvEntry.create({
      userId,
      apiKeyId,
      key: 'shared-name',
      value: 'from-key1',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const entry = await KvEntry.create({
      userId,
      apiKeyId: otherApiKeyId,
      key: 'shared-name',
      value: 'from-key2',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    expect(entry.key).toBe('shared-name');
    expect(entry.value).toBe('from-key2');
  });

  it('findOneAndUpdate upsert creates new entry', async () => {
    const entry = await KvEntry.findOneAndUpdate(
      { apiKeyId, key: 'upsert-new' },
      { $set: { userId, value: 'created', expiresAt: new Date(Date.now() + 86400_000) } },
      { upsert: true, new: true },
    );

    expect(entry).toBeDefined();
    expect(entry!.key).toBe('upsert-new');
    expect(entry!.value).toBe('created');
  });

  it('findOneAndUpdate upsert updates existing entry', async () => {
    await KvEntry.create({
      userId,
      apiKeyId,
      key: 'upsert-existing',
      value: 'original',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const entry = await KvEntry.findOneAndUpdate(
      { apiKeyId, key: 'upsert-existing' },
      { $set: { value: 'updated' } },
      { new: true },
    );

    expect(entry!.value).toBe('updated');
  });

  it('atomic increment with $inc', async () => {
    await KvEntry.create({
      userId,
      apiKeyId,
      key: 'counter',
      value: 5,
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const updated = await KvEntry.findOneAndUpdate(
      { apiKeyId, key: 'counter' },
      { $inc: { value: 3 } },
      { new: true },
    );

    expect(updated!.value).toBe(8);
  });

  it('findOneAndDelete removes entry', async () => {
    await KvEntry.create({
      userId,
      apiKeyId,
      key: 'to-delete',
      value: 'gone',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const deleted = await KvEntry.findOneAndDelete({ apiKeyId, key: 'to-delete' });
    expect(deleted).toBeDefined();
    expect(deleted!.key).toBe('to-delete');

    const found = await KvEntry.findOne({ apiKeyId, key: 'to-delete' });
    expect(found).toBeNull();
  });

  it('countDocuments with filter', async () => {
    await KvEntry.create([
      { userId, apiKeyId, key: 'c1', value: 1, expiresAt: new Date(Date.now() + 86400_000) },
      { userId, apiKeyId, key: 'c2', value: 2, expiresAt: new Date(Date.now() + 86400_000) },
      { userId, apiKeyId, key: 'c3', value: 3, expiresAt: new Date(Date.now() + 86400_000) },
    ]);

    const count = await KvEntry.countDocuments({ apiKeyId });
    expect(count).toBe(3);

    const partial = await KvEntry.countDocuments({ apiKeyId, key: { $regex: /^c[12]$/ } });
    expect(partial).toBe(2);
  });

  it('stores various value types', async () => {
    const values = [
      { input: 'string', expected: 'string' },
      { input: 42, expected: 42 },
      { input: true, expected: true },
      { input: [1, 2, 3], expected: [1, 2, 3] },
      { input: { a: { b: 'deep' } }, expected: { a: { b: 'deep' } } },
    ];

    for (let i = 0; i < values.length; i++) {
      await KvEntry.create({
        userId,
        apiKeyId,
        key: `type-test-${i}`,
        value: values[i].input,
        expiresAt: new Date(Date.now() + 86400_000),
      });
    }

    for (let i = 0; i < values.length; i++) {
      const found = await KvEntry.findOne({ apiKeyId, key: `type-test-${i}` });
      expect(found!.value).toEqual(values[i].expected);
    }
  });
});
