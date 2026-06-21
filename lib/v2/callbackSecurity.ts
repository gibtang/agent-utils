/**
 * AgentUtils v2 — callback security layer (PRD §6.1, §6.2).
 *
 * Two responsibilities:
 *  1. SSRF protection: validate callback URLs (HTTPS-only, reject loopback /
 *     private / link-local / metadata IPs, no redirect following, DNS recheck).
 *  2. Signed callbacks: HMAC-SHA256 over `<timestamp>.<rawRequestBody>`.
 *
 * Used by Scheduler (card 7) and HitL (card 8).
 */
import { Errors, ApiError } from './errors';
import { signCallback } from './crypto';

const HTTPS_RE = /^https:\/\//i;

// IP literal checks — works for IPv4 and IPv6.
function isLoopback(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('127.')) return true;
  if (v === '0.0.0.0') return true;
  // IPv6 loopback variants
  if (/^fe[89ab][0-9a-f]:/i.test(v)) return false; // link-local handled below
  return false;
}

function isPrivate(ip: string): boolean {
  const v = ip.toLowerCase();
  // IPv4 private ranges (RFC1918) + CGNAT + 0.0.0.0/8
  if (/^10\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^169\.254\./.test(v)) return true; // link-local + metadata
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(v)) return true; // CGNAT
  if (/^0\./.test(v)) return true;
  // IPv6 ULA fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(v)) return true;
  return false;
}

function isMetadata(ip: string): boolean {
  // AWS / GCP / Azure metadata endpoints
  return ip === '169.254.169.254' || ip === 'fd00:ec2::254';
}

function isReservedOrMulticast(ip: string): boolean {
  const v = ip.toLowerCase();
  // IPv4 multicast 224.0.0.0/4
  if (/^(22[5-9]|23\d)\./.test(v)) return true;
  if (/^2(2[4-9])\./.test(v)) return true;
  // 240.0.0.0/4 reserved
  if (/^(24\d|25[0-5])\./.test(v)) return true;
  return false;
}

function isLinkLocal(ip: string): boolean {
  return /^169\.254\./.test(ip) || /^fe[89ab][0-9a-f]:/i.test(ip.toLowerCase());
}

function ipIsForbidden(ip: string): boolean {
  return isLoopback(ip) || isPrivate(ip) || isMetadata(ip) || isReservedOrMulticast(ip) || isLinkLocal(ip);
}

/**
 * Resolve a hostname to its IP(s) using Node's dns.lookup (all addresses).
 * Returns [] if unresolvable.
 */
async function resolveHost(hostname: string): Promise<string[]> {
  const dns = await import('node:dns/promises');
  try {
    const result = await dns.lookup(hostname, { all: true });
    return result.map((r) => r.address);
  } catch {
    return [];
  }
}

export interface CallbackValidationResult {
  ok: boolean;
  error?: ApiError;
  hostname?: string;
  resolvedIps?: string[];
}

/**
 * Validate a callback URL for SSRF safety. Checks scheme, hostname, and DNS.
 * Returns { ok: true } or { ok: false, error }.
 */
export async function validateCallbackUrl(url: string): Promise<CallbackValidationResult> {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
    return { ok: false, error: Errors.validation('callback_url must be a valid HTTPS URL', { field: 'callback_url' }) };
  }
  if (!HTTPS_RE.test(url)) {
    return { ok: false, error: Errors.validation('callback_url must use HTTPS', { field: 'callback_url' }) };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: Errors.validation('callback_url must be a valid URL', { field: 'callback_url' }) };
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (!hostname) {
    return { ok: false, error: Errors.validation('callback_url must have a hostname', { field: 'callback_url' }) };
  }

  // If the hostname is already an IP literal, check it directly.
  if (isIpLiteral(hostname)) {
    if (ipIsForbidden(hostname)) {
      return { ok: false, error: Errors.validation('callback_url host resolves to a forbidden IP', { field: 'callback_url' }) };
    }
    return { ok: true, hostname, resolvedIps: [hostname] };
  }

  // Reject obvious localhost hostnames.
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, error: Errors.validation('callback_url must not point to localhost', { field: 'callback_url' }) };
  }

  const ips = await resolveHost(hostname);
  if (ips.length === 0) {
    return { ok: false, error: Errors.validation('callback_url hostname could not be resolved', { field: 'callback_url' }) };
  }
  for (const ip of ips) {
    if (ipIsForbidden(ip)) {
      return { ok: false, error: Errors.validation('callback_url host resolves to a forbidden IP', { field: 'callback_url' }) };
    }
  }
  return { ok: true, hostname, resolvedIps: ips };
}

function isIpLiteral(s: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) || s.includes(':');
}

// ── Signed callback headers ─────────────────────────────────────────────────

export interface SignedCallbackHeaders {
  event: string;            // schedule.fired | checkpoint.resolved
  timestamp: string;        // ISO 8601 UTC
  signature: string;        // v1=<hex>
  deliveryId: string;       // del_xxx
  extra?: Record<string, string>; // tool-specific headers (schedule-id, attempt)
}

/** Build the signed-callback header set for an outbound POST. */
export function buildSignedHeaders(
  secret: string,
  event: string,
  rawBody: string,
  deliveryId: string,
  extra?: Record<string, string>,
  timestamp: Date = new Date(),
): SignedCallbackHeaders {
  const ts = timestamp.toISOString();
  const signature = signCallback(secret, ts, rawBody);
  return { event, timestamp: ts, signature, deliveryId, extra };
}

/**
 * Attempt to deliver a signed callback. No redirect following. Returns the
 * response status (or 0 on network error). Throws on non-2xx only if throwOnError.
 */
export async function deliverCallback(
  url: string,
  secret: string,
  event: string,
  body: unknown,
  deliveryId: string,
  extraHeaders?: Record<string, string>,
  timeoutMs = 30_000,
): Promise<{ ok: boolean; status: number; statusText: string }> {
  const rawBody = JSON.stringify(body);
  const signed = buildSignedHeaders(secret, event, rawBody, deliveryId, extraHeaders);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // redirect: 'error' rejects on any 3xx — SSRF defence (PRD §6.2)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentUtils-Event': signed.event,
        'X-AgentUtils-Timestamp': signed.timestamp,
        'X-AgentUtils-Signature': signed.signature,
        'X-AgentUtils-Delivery-Id': signed.deliveryId,
        ...(signed.extra ?? {}),
      },
      body: rawBody,
      redirect: 'error',
      signal: controller.signal,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, statusText: res.statusText };
  } catch (e) {
    return { ok: false, status: 0, statusText: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
