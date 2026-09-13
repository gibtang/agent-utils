import mongoose from 'mongoose';
import { getServerConfig } from './config';

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
declare global { var coreMongoose: MongooseCache | undefined; }
const cached = globalThis.coreMongoose ?? { conn: null, promise: null };
globalThis.coreMongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
  if (mongoose.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }
  if (!cached.promise) cached.promise = mongoose.connect(getServerConfig().mongoUri, { bufferCommands: false });
  try { cached.conn = await cached.promise; return cached.conn; }
  catch (error) { cached.promise = null; throw error; }
}
export const getDb = connectDB;
