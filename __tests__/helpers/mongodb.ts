import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Tenant from '@/models/v2/Tenant';
import Agent from '@/models/v2/Agent';
import ApiCredential from '@/models/v2/ApiCredential';
import KvEntry from '@/models/v2/KvEntry';
import AuditLog from '@/models/v2/AuditLog';
import DlqItem from '@/models/v2/DlqItem';
import Schedule from '@/models/v2/Schedule';
import Checkpoint from '@/models/v2/Checkpoint';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Clear any cached connection
  const mongooseCache = global as unknown as { mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } };
  if (mongooseCache.mongoose) {
    mongooseCache.mongoose.conn = null;
    mongooseCache.mongoose.promise = null;
  }

  // Set the URI so connectDB() uses our in-memory server
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);

  // Ensure all v2 unique indexes are built before any test runs. Without this,
  // mongoose's lazy autoIndex can let duplicate inserts slip through on the
  // first operation of a freshly-wiped collection.
  await Promise.all([
    Tenant.createIndexes(),
    Agent.createIndexes(),
    ApiCredential.createIndexes(),
    KvEntry.createIndexes(),
    AuditLog.createIndexes(),
    DlqItem.createIndexes(),
    Schedule.createIndexes(),
    Checkpoint.createIndexes(),
  ]);
});;

afterEach(async () => {
  // Clean all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
