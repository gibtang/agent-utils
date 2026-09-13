import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { connectDB } from '@/lib/core/db';
import { Errors } from '@/lib/core/errors';
import { safeEqualText } from '@/lib/core/secrets';
import { hashHandoffToken } from './crypto';
import Activity from '@/models/Activity';

export type CallbackHeaders = { 'x-agentutils-timestamp': string; 'x-agentutils-signature': string };
type CallbackHandoff = { handoffId: string; accountId: string; agentId?: string | null; status: string; callbackUrl?: string | null; callbackSecretHash?: string | null; submittedAt?: Date | null };
type NotifyOptions = { guard?: (url: string) => Promise<void>; timeoutMs?: number; now?: Date };
type NotifyResult = { delivered: true } | { delivered: false; reason: 'secret-mismatch' | `http-${number}` | 'timeout' | 'network-error' | 'blocked' };

export function signCallbackPayload(secretHex: string, timestampMs: number, body: string): string {
  return `v1=${createHmac('sha256', secretHex).update(`${timestampMs}.${body}`, 'utf8').digest('hex')}`;
}

export function buildCallbackHeaders(secretHex: string, body: string, timestampMs: number): CallbackHeaders {
  return { 'x-agentutils-timestamp': String(timestampMs), 'x-agentutils-signature': signCallbackPayload(secretHex, timestampMs, body) };
}

export function verifyCallbackSignature(secretHex: string, timestampMs: number, body: string, header: string): boolean {
  return safeEqualText(signCallbackPayload(secretHex, timestampMs, body), header);
}

function isPrivateV4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function isPrivateV6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mapped = normalized.match(/^(?:0:){0,5}ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  const [left, right = ''] = normalized.split('::');
  if (normalized.split('::').length > 2) return true;
  const leftParts = left ? left.split(':') : []; const rightParts = right ? right.split(':') : [];
  const parts = [...leftParts, ...Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill('0'), ...rightParts];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return true;
  const values = parts.map((part) => parseInt(part, 16));
  // IPv4-mapped IPv6 answers (for example ::ffff:7f00:1) inherit IPv4 restrictions.
  if (values.slice(0, 5).every((part) => part === 0) && values[5] === 0xffff) {
    return isPrivateV4(`${values[6] >> 8}.${values[6] & 0xff}.${values[7] >> 8}.${values[7] & 0xff}`);
  }
  const first = values[0];
  const allZero = values.every((part) => part === 0);
  const loopback = values.slice(0, 7).every((part) => part === 0) && values[7] === 1;
  return allZero || loopback || (first >= 0xfe80 && first < 0xfec0) || (first >= 0xfc00 && first < 0xfe00) || first >= 0xff00;
}

function isGlobalAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !isPrivateV4(address) : family === 6 ? !isPrivateV6(address) : false;
}

/**
 * Resolving before connecting cannot fully eliminate DNS-rebinding TOCTOU risk. We allow only
 * globally-routable answers, then fetch the hostname once (with redirects disabled) rather than
 * following a chain to a newly-resolved destination.
 */
export async function assertCallbackUrl(value: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw Errors.validationFailed(); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Errors.validationFailed();
  let addresses: Array<{ address: string }>;
  try { addresses = await lookup(parsed.hostname, { all: true }); } catch { throw Errors.validationFailed(); }
  if (addresses.length === 0 || addresses.some(({ address }) => !isGlobalAddress(address))) throw Errors.validationFailed();
}

async function recordFailure(handoff: CallbackHandoff, reason: Exclude<NotifyResult, { delivered: true }>['reason']): Promise<void> {
  await connectDB();
  await Activity.create({ accountId: handoff.accountId, agentId: handoff.agentId ?? null, handoffId: handoff.handoffId, event: 'handoff.notify_failed', metadata: { reason } });
}

export async function notifySubmission(handoff: CallbackHandoff, callbackSecretHex: string, opts: NotifyOptions = {}): Promise<NotifyResult> {
  if (!handoff.callbackUrl || handoff.status !== 'submitted' || !handoff.callbackSecretHash) {
    await recordFailure(handoff, 'blocked'); return { delivered: false, reason: 'blocked' };
  }
  // The secret is returned only to the creating agent by createHandoff; only its SHA-256 hash is stored.
  if (!safeEqualText(hashHandoffToken(callbackSecretHex), handoff.callbackSecretHash)) return { delivered: false, reason: 'secret-mismatch' };
  const guard = opts.guard ?? assertCallbackUrl;
  await guard(handoff.callbackUrl);
  const submittedAt = handoff.submittedAt ?? opts.now ?? new Date();
  const body = JSON.stringify({ event: 'handoff.submitted', handoffId: handoff.handoffId, accountId: handoff.accountId, submittedAt: submittedAt.toISOString() });
  const timestamp = (opts.now ?? new Date()).getTime(); const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  let result: NotifyResult;
  try {
    const response = await fetch(handoff.callbackUrl, { method: 'POST', body, headers: { 'content-type': 'application/json', ...buildCallbackHeaders(callbackSecretHex, body, timestamp) }, signal: controller.signal, redirect: 'error' });
    result = response.ok ? { delivered: true } : { delivered: false, reason: `http-${response.status}` };
  } catch (error) {
    result = (error instanceof Error && error.name === 'AbortError') ? { delivered: false, reason: 'timeout' } : { delivered: false, reason: 'network-error' };
  } finally { clearTimeout(timer); }
  if (!result.delivered) await recordFailure(handoff, result.reason);
  return result;
}
