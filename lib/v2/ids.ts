/**
 * AgentUtils v2 — ID generation.
 * PRD prefixes: ten_, agent id (name-derived), sched_, dlq_, hitl_, log_,
 * del_, req_, agutil_adm_, agutil_agt_.
 *
 * IDs use a Crockford-Base32 ULID-like time-sortable encoding so IDs sort
 * chronologically by creation and are URL safe.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number, len: number): string {
  let str = '';
  let time = now;
  for (let i = len - 1; i >= 0; i--) {
    const mod = time % ENCODING_LEN;
    str = ENCODING[mod] + str;
    time = Math.floor(time / ENCODING_LEN);
  }
  return str;
}

function randomChar(): string {
  return ENCODING[Math.floor(Math.random() * ENCODING_LEN)];
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now, TIME_LEN) + Array.from({ length: RANDOM_LEN }, randomChar).join('');
}

/** Prefixed resource id, e.g. `sched_01HXYZ...` */
export function resourceId(prefix: string): string {
  return `${prefix}${ulid()}`;
}

/** Request id used in every response meta/error envelope. */
export function requestId(): string {
  return `req_${ulid()}`;
}

const RANDOM_KEY_BYTES = 32;

function randomHex(bytes: number = RANDOM_KEY_BYTES): string {
  const buf = new Uint8Array(bytes);
  // Node global crypto
  (globalThis as { crypto: Crypto }).crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Full tenant admin key (shown once). */
export function generateAdminKey(): string {
  return `agutil_adm_${randomHex()}`;
}

/** Full agent key (shown once). */
export function generateAgentKey(): string {
  return `agutil_agt_${randomHex()}`;
}
