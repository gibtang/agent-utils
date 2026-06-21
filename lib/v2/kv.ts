/**
 * AgentUtils v2 — KV helpers (size, namespace resolution).
 */
import { RESERVED_AGENT_NAMES } from '@/models/v2/Agent';

/** Max UTF-8 serialized JSON value size (PRD R-KV-7). */
export const KV_MAX_VALUE_BYTES = 100 * 1024;

/** Key format: max 512 bytes, [a-zA-Z0-9:._-]. */
export const KEY_RE = /^[a-zA-Z0-9:._-]{1,512}$/;

/** Agent-name format (re-used for namespace validation). */
export const NAMESPACE_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;

export function utf8Bytes(s: string): number {
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(s, 'utf8');
  return new TextEncoder().encode(s).length;
}

export function serializedBytes(value: unknown): number {
  return utf8Bytes(JSON.stringify(value));
}

/**
 * Resolve the effective namespace for a (callerAgentId, requestedNamespace).
 * - caller's own private namespace: OK
 * - "shared": OK for any authenticated agent in the tenant
 * - any other agent's namespace: 403 NAMESPACE_FORBIDDEN
 */
export function authorizeNamespace(
  callerAgentId: string,
  requestedNamespace: string,
): { ok: true; namespace: string } | { ok: false; reason: 'forbidden' } {
  if (requestedNamespace === callerAgentId) return { ok: true, namespace: requestedNamespace };
  if (requestedNamespace === 'shared') return { ok: true, namespace: 'shared' };
  return { ok: false, reason: 'forbidden' };
}

export function isReservedNamespace(ns: string): boolean {
  return RESERVED_AGENT_NAMES.has(ns);
}
