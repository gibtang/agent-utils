/**
 * AgentUtils v2 — idempotency (PRD §6.3).
 *
 * Idempotency keys are scoped by (tenantId, endpoint). Reusing the same key with
 * the same body returns the original response; a different body returns 409
 * CONFLICT.
 */
import type { NextRequest, NextResponse } from 'next/server';
import connectDB from './db';

export interface IdempotencyRecord {
  tenantId: string;
  endpoint: string; // e.g. "POST /v1/agents"
  key: string; // Idempotency-Key header
  requestHash: string; // sha256 of normalized request body
  status: number;
  body: unknown; // stored response body
  createdAt: Date;
}

// Mongoose model defined inline to avoid an extra file round-trip.
import mongoose, { Schema } from 'mongoose';

const IdempotencySchema = new Schema(
  {
    tenantId: { type: String, required: true },
    endpoint: { type: String, required: true },
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { type: Number, required: true },
    body: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date(), expires: 86400 }, // 24h TTL
  },
  { timestamps: true },
);
IdempotencySchema.index({ tenantId: 1, endpoint: 1, key: 1 }, { unique: true });

const IdempotencyModel =
  (mongoose.models.IdempotencyKeyV2 as mongoose.Model<IdempotencyRecord>) ||
  mongoose.model<IdempotencyRecord>('IdempotencyKeyV2', IdempotencySchema);

import { createHash } from 'crypto';

export function hashBody(body: unknown): string {
  if (body === undefined || body === null) return '0';
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export function readIdempotencyKey(req: NextRequest): string | null {
  const k = req.headers.get('idempotency-key');
  return k && k.length > 0 ? k : null;
}

/**
 * Lookup an existing idempotency record. Returns:
 *  - null: no prior record, proceed
 *  - { kind: 'replay', status, body }: same key+body -> replay response
 *  - { kind: 'conflict' }: same key, different body -> 409
 *  - { kind: 'inflight' }: same key+body but no stored response yet -> 409 CONFLICT
 */
export async function lookupIdempotency(
  tenantId: string,
  endpoint: string,
  key: string,
  body: unknown,
): Promise<{ kind: 'none' } | { kind: 'replay'; status: number; body: unknown } | { kind: 'conflict' } | { kind: 'inflight' }> {
  await connectDB();
  const requestHash = hashBody(body);
  const existing = await IdempotencyModel.findOne({ tenantId, endpoint, key }).lean();
  if (!existing) return { kind: 'none' };
  if (existing.requestHash !== requestHash) return { kind: 'conflict' };
  if (existing.body === undefined) return { kind: 'inflight' };
  return { kind: 'replay', status: existing.status, body: existing.body };
}

/**
 * Persist a response for an idempotency key. Uses an upsert with conditional
 * requestHash to atomically reserve the key on first use.
 *
 * Returns true if this caller owns the record, false if a concurrent caller won.
 */
export async function storeIdempotency(
  tenantId: string,
  endpoint: string,
  key: string,
  body: unknown,
  status: number,
  responseBody: unknown,
): Promise<boolean> {
  await connectDB();
  const requestHash = hashBody(body);
  try {
    // upsert stores the response snapshot. Same-field $setOnInsert+$set is
    // disallowed by Mongo, so use a plain $set (sets on insert and update).
    await IdempotencyModel.updateOne(
      { tenantId, endpoint, key, requestHash },
      { $set: { requestHash, status, body: responseBody } },
      { upsert: true },
    );
    return true;
  } catch {
    // Duplicate key on a concurrent write — the other caller owns it.
    return false;
  }
}
