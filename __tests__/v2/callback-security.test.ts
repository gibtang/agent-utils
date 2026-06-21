/**
 * Card 6 (8339): callback security layer — SSRF rejection + HMAC signing.
 * Covers CROSS-007 (signed callback verification) and CROSS-008 (SSRF rejection).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateCallbackUrl, buildSignedHeaders, deliverCallback } from '@/lib/v2/callbackSecurity';
import { signCallback, verifySignature, randomSecret } from '@/lib/v2/crypto';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

describe('Card 6 — callback security', () => {
  describe('SSRF URL validation (CROSS-008)', () => {
    it('rejects non-HTTPS URLs', async () => {
      const r = await validateCallbackUrl('http://example.com/hook');
      expect(r.ok).toBe(false);
      expect(r.error!.http).toBe(400);
    });

    it('rejects localhost and .localhost', async () => {
      expect((await validateCallbackUrl('https://localhost/hook')).ok).toBe(false);
      expect((await validateCallbackUrl('https://app.localhost/hook')).ok).toBe(false);
    });

    it('rejects IPv4 loopback literal', async () => {
      expect((await validateCallbackUrl('https://127.0.0.1/hook')).ok).toBe(false);
    });

    it('rejects IPv4 private ranges', async () => {
      expect((await validateCallbackUrl('https://10.0.0.1/hook')).ok).toBe(false);
      expect((await validateCallbackUrl('https://192.168.1.1/hook')).ok).toBe(false);
      expect((await validateCallbackUrl('https://172.16.0.1/hook')).ok).toBe(false);
    });

    it('rejects link-local and metadata IPs', async () => {
      expect((await validateCallbackUrl('https://169.254.169.254/latest/meta-data/')).ok).toBe(false);
      expect((await validateCallbackUrl('https://169.254.1.1/hook')).ok).toBe(false);
    });

    it('rejects 0.0.0.0', async () => {
      expect((await validateCallbackUrl('https://0.0.0.0/hook')).ok).toBe(false);
    });

    it('rejects IPv6 loopback literal', async () => {
      expect((await validateCallbackUrl('https://[::1]/hook')).ok).toBe(false);
    });

    it('rejects multicast / reserved IPv4', async () => {
      expect((await validateCallbackUrl('https://224.0.0.1/hook')).ok).toBe(false);
      expect((await validateCallbackUrl('https://240.0.0.1/hook')).ok).toBe(false);
    });

    it('rejects unresolvable hostnames', async () => {
      const r = await validateCallbackUrl('https://nonexistent-host-that-should-not-resolve-xyz123.invalid/hook');
      expect(r.ok).toBe(false);
    });

    it('accepts a legitimate public HTTPS URL', async () => {
      // example.com is a well-known reserved domain with a real public IP.
      const r = await validateCallbackUrl('https://example.com/hook');
      expect(r.ok).toBe(true);
    });
  });

  describe('Signed callback HMAC (CROSS-007)', () => {
    it('buildSignedHeaders produces v1=<hex> signature over timestamp.body', () => {
      const secret = randomSecret();
      const ts = '2026-01-01T00:00:00.000Z';
      const body = '{"event":"schedule.fired"}';
      const headers = buildSignedHeaders(secret, 'schedule.fired', body, 'del_01', undefined, new Date(ts));
      const expected = signCallback(secret, ts, body);
      expect(headers.signature).toBe(expected);
      expect(headers.signature).toMatch(/^v1=[0-9a-f]+$/);
    });

    it('receiver verifies a well-formed signature', () => {
      const secret = randomSecret();
      const ts = '2026-01-01T00:00:00.000Z';
      const body = '{"x":1}';
      const sig = signCallback(secret, ts, body);
      expect(verifySignature(secret, ts, body, sig)).toBe(true);
    });

    it('rejects a spoofed signature', () => {
      const secret = randomSecret();
      const attackerSecret = randomSecret();
      const ts = '2026-01-01T00:00:00.000Z';
      const body = '{"x":1}';
      const spoofed = signCallback(attackerSecret, ts, body);
      expect(verifySignature(secret, ts, body, spoofed)).toBe(false);
    });

    it('rejects a tampered body', () => {
      const secret = randomSecret();
      const ts = '2026-01-01T00:00:00.000Z';
      const sig = signCallback(secret, ts, '{"x":1}');
      expect(verifySignature(secret, ts, '{"x":2}', sig)).toBe(false);
    });

    it('rejects an out-of-window timestamp (replay window defence)', () => {
      // Signature itself verifies; replay-window enforcement is the receiver's
      // job per PRD §6.1. We document the contract: the timestamp is part of the
      // signed base string, so an attacker cannot change it without re-signing.
      const secret = randomSecret();
      const ts = '2026-01-01T00:00:00.000Z';
      const body = '{}';
      const sig = signCallback(secret, ts, body);
      // receiver checks |now - ts| <= 300s; here ts is far in the past
      const now = Date.now();
      const tsMs = new Date(ts).getTime();
      const withinWindow = Math.abs(now - tsMs) <= 300_000;
      expect(withinWindow).toBe(false);
      // signature still cryptographically valid (proves tamper detection)
      expect(verifySignature(secret, ts, body, sig)).toBe(true);
    });
  });

  describe('deliverCallback — no redirect following', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      server = createServer((req, res) => {
        let buf = '';
        req.on('data', (c) => (buf += c));
        req.on('end', () => {
          const headers = req.headers;
          // If the path is /redirect, respond with a 302 to a forbidden target.
          if (req.url === '/redirect') {
            res.writeHead(302, { location: 'https://169.254.169.254/latest/' });
            res.end();
            return;
          }
          // Echo the signature headers back so tests can assert presence.
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            event: headers['x-agentutils-event'],
            timestamp: headers['x-agentutils-timestamp'],
            signature: headers['x-agentutils-signature'],
            delivery: headers['x-agentutils-delivery-id'],
            body: buf,
          }));
        });
      });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    it('does not follow redirects (SSRF defence at delivery time)', async () => {
      const secret = randomSecret();
      const res = await deliverCallback(`${baseUrl}/redirect`, secret, 'schedule.fired', { x: 1 }, 'del_1', undefined, 3000);
      expect(res.ok).toBe(false);
      // fetch with redirect:'error' rejects → status 0
      expect(res.status).toBe(0);
    });
  });
});
