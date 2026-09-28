import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB } from '@/lib/core/db';
import { resetConfigCacheForTests } from '@/lib/core/config';
import Handoff from '@/models/Handoff';
import Activity from '@/models/Activity';
import { assertCallbackUrl, buildCallbackHeaders, notifySubmission, signCallbackPayload, verifyCallbackSignature } from '@/lib/handoff/notify';
import { hashHandoffToken } from '@/lib/handoff/crypto';

let mongo: MongoMemoryServer;
beforeAll(async () => { mongo = await MongoMemoryServer.create(); process.env.MONGODB_URI = mongo.getUri(); resetConfigCacheForTests(); await connectDB(); await Promise.all([Handoff.createIndexes(), Activity.createIndexes()]); });
afterEach(async () => { await Promise.all([Handoff.deleteMany({}), Activity.deleteMany({})]); });
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); resetConfigCacheForTests(); });

const secret = 'a'.repeat(64); const timestamp = 1_767_225_600_000;
const body = JSON.stringify({ event: 'handoff.submitted', handoffId: 'cv_test', accountId: 'acct_test', submittedAt: '2026-01-01T00:00:00.000Z' });
const handoff = (overrides: Record<string, unknown> = {}) => ({ handoffId: 'cv_test', accountId: 'acct_test', status: 'submitted', callbackUrl: 'http://127.0.0.1', callbackSecretHash: hashHandoffToken(secret), submittedAt: new Date('2026-01-01T00:00:00.000Z'), ...overrides });
async function listener(handler: (req: import('node:http').IncomingMessage, body: string, res: import('node:http').ServerResponse) => void): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => { let text = ''; req.on('data', (chunk: Buffer) => { text += chunk; }); req.on('end', () => handler(req, text, res)); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
  if (!address || typeof address === 'string') throw new Error('bad test listener');
  return { server, url: `http://127.0.0.1:${address.port}/callback` };
}

describe('handoff webhook notify', () => {
  it('signs exact bodies and verifies signatures in constant time', () => {
    const signature = signCallbackPayload(secret, timestamp, body); const headers = buildCallbackHeaders(secret, body, timestamp);
    expect(signature).toMatch(/^v1=[0-9a-f]{64}$/); expect(headers).toEqual({ 'x-agentutils-timestamp': String(timestamp), 'x-agentutils-signature': signature });
    expect(verifyCallbackSignature(secret, timestamp, body, signature)).toBe(true);
    expect(verifyCallbackSignature('b'.repeat(64), timestamp, body, signature)).toBe(false);
    expect(verifyCallbackSignature(secret, timestamp, `${body} `, signature)).toBe(false);
  });

  it.each(['http://example.com', 'https://127.0.0.1', 'https://169.254.169.254', 'https://192.168.1.1', 'https://[::1]', 'https://does-not-exist-agentutils.invalid'])('blocks unsafe callback URL %s', async (url) => {
    await expect(assertCallbackUrl(url)).rejects.toMatchObject({ code: 'validation_failed' });
  });
  it('allows a public IP without performing network I/O', async () => { await expect(assertCallbackUrl('https://1.1.1.1')).resolves.toBeUndefined(); });

  it('delivers an allowed guarded-in-test local callback with only the safe payload', async () => {
    let received: { body: string; timestamp?: string; signature?: string } | undefined;
    const target = await listener((req, receivedBody, res) => { received = { body: receivedBody, timestamp: req.headers['x-agentutils-timestamp'] as string, signature: req.headers['x-agentutils-signature'] as string }; res.writeHead(200); res.end(); });
    try {
      const result = await notifySubmission(handoff({ callbackUrl: target.url }), secret, { guard: async () => undefined, now: new Date('2026-01-01T00:00:00.000Z') });
      expect(result).toEqual({ delivered: true }); expect(received).toBeDefined();
      const payload = JSON.parse(received!.body) as Record<string, unknown>; expect(Object.keys(payload)).toEqual(['event', 'handoffId', 'accountId', 'submittedAt']);
      expect(verifyCallbackSignature(secret, Number(received!.timestamp), received!.body, received!.signature!)).toBe(true);
    } finally { await new Promise<void>((resolve, reject) => target.server.close((error) => error ? reject(error) : resolve())); }
  });

  it('does not make a request when the supplied callback secret mismatches', async () => {
    let hits = 0; const target = await listener((_req, _body, res) => { hits += 1; res.end(); });
    try { await expect(notifySubmission(handoff({ callbackUrl: target.url }), 'b'.repeat(64), { guard: async () => undefined })).resolves.toEqual({ delivered: false, reason: 'secret-mismatch' }); expect(hits).toBe(0); } finally { await new Promise<void>((resolve, reject) => target.server.close((error) => error ? reject(error) : resolve())); }
  });

  it('classifies non-2xx and records a safe failure activity', async () => {
    const target = await listener((_req, _body, res) => { res.writeHead(401); res.end(); });
    try {
      await expect(notifySubmission(handoff({ callbackUrl: target.url }), secret, { guard: async () => undefined })).resolves.toEqual({ delivered: false, reason: 'http-401' });
      const activity = await Activity.findOne({ handoffId: 'cv_test' }).lean(); expect(activity).toMatchObject({ accountId: 'acct_test', event: 'handoff.notify_failed', metadata: { reason: 'http-401' } }); expect(Object.keys(activity!.metadata)).toEqual(['reason']);
    } finally { await new Promise<void>((resolve, reject) => target.server.close((error) => error ? reject(error) : resolve())); }
  });

  it('classifies an aborted request as timeout and records it', async () => {
    const target = await listener(() => undefined);
    try { await expect(notifySubmission(handoff({ callbackUrl: target.url }), secret, { guard: async () => undefined, timeoutMs: 20 })).resolves.toEqual({ delivered: false, reason: 'timeout' }); expect(await Activity.findOne({ event: 'handoff.notify_failed', 'metadata.reason': 'timeout' }).lean()).not.toBeNull(); } finally { await new Promise<void>((resolve, reject) => target.server.close((error) => error ? reject(error) : resolve())); }
  });
});
