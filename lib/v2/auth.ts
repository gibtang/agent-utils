/**
 * AgentUtils v2 — credential resolution (PRD §5.1).
 *
 * The single most important rule: {tenant_id, agent_id, key_type} is resolved
 * exclusively from the stored key. tenant_id is NEVER trusted from body/query/
 * headers and is injected as an implicit filter into every downstream query.
 */
import type { NextRequest } from 'next/server';
import connectDB from './db';
import ApiCredential from '@/models/v2/ApiCredential';
import Tenant from '@/models/v2/Tenant';
import Agent from '@/models/v2/Agent';
import { Errors, ApiError } from './errors';
import { hashKey, safeEqualHex } from './crypto';

export interface ResolvedAdmin {
  kind: 'admin';
  tenantId: string;
  tenantStatus: string;
  plan: string;
}

export interface ResolvedApprovalProxy {
  kind: 'approval-proxy';
  tenantId: string;
  tenantStatus: string;
  plan: string;
}

export interface ResolvedAgent {
  kind: 'agent';
  tenantId: string;
  agentId: string;
  tenantStatus: string;
  plan: string;
}

export type Resolved = ResolvedAdmin | ResolvedAgent | ResolvedApprovalProxy;

export interface Resolution {
  resolved: Resolved;
  requestId: string;
}

/**
 * Resolve credentials from request headers.
 * @param requireAdminKey - true if the endpoint is admin-only (tenant mgmt).
 * @param allowAgentKey   - true if agent keys are permitted (tool endpoints).
 * @param agentIdRequired - when agent key used, X-Agent-Id must match the record.
 */
export async function resolveCredentials(
  req: NextRequest,
  opts: { requireAdminKey?: boolean; allowAgentKey?: boolean; requireApprovalKey?: boolean } = {},
): Promise<Resolution | ApiError> {
  await connectDB();

  const requestId = (req.headers.get('x-request-id') as string) || undefined;
  const adminKey = req.headers.get('x-admin-key');
  const approvalKey = req.headers.get('x-approval-key');
  const apiKey = req.headers.get('x-api-key');
  const presentedAgentId = req.headers.get('x-agent-id');

  const hasAdmin = !!adminKey;
  const hasApproval = !!approvalKey;
  const hasAgent = !!apiKey;

  if (!hasAdmin && !hasAgent && !hasApproval) {
    return Errors.missingAuth();
  }

  // Determine which key to use. Admin endpoints require admin key.
  let keyType: 'admin' | 'agent' | 'approval-proxy';
  let rawKey: string;

  if (opts.requireAdminKey) {
    if (!hasAdmin) {
      // Agent key presented on an admin-only endpoint.
      return Errors.adminRequired();
    }
    keyType = 'admin';
    rawKey = adminKey as string;
  } else if (opts.requireApprovalKey) {
    if (!hasApproval) {
      return Errors.forbidden('Approval-proxy or admin key required');
    }
    keyType = 'approval-proxy';
    rawKey = approvalKey as string;
  } else if (hasAdmin && !opts.allowAgentKey) {
    keyType = 'admin';
    rawKey = adminKey as string;
  } else if (hasAgent) {
    keyType = 'agent';
    rawKey = apiKey as string;
  } else if (hasApproval) {
    keyType = 'approval-proxy';
    rawKey = approvalKey as string;
  } else {
    keyType = 'admin';
    rawKey = adminKey as string;
  }

  if (keyType === 'admin' && !rawKey.startsWith('agutil_adm_')) {
    return Errors.invalidCreds();
  }
  if (keyType === 'agent' && !rawKey.startsWith('agutil_agt_')) {
    return Errors.invalidCreds();
  }
  if (keyType === 'approval-proxy' && !rawKey.startsWith('agutil_apr_')) {
    return Errors.invalidCreds();
  }

  // Lookup by hash. A single indexed lookup.
  const keyHash = hashKey(rawKey);
  const cred = await ApiCredential.findOne({ keyHash, active: true }).lean();
  if (!cred) {
    return Errors.invalidCreds();
  }
  // Defensive double-check the stored hash matches (index is on keyHash).
  if (!safeEqualHex(cred.keyHash, keyHash)) {
    return Errors.invalidCreds();
  }

  if (cred.keyType !== keyType) {
    // e.g. agent key presented via X-Admin-Key, or admin key via X-Api-Key.
    return Errors.invalidCreds();
  }

  // Verify tenant exists and key belongs to a live tenant.
  const tenant = await Tenant.findOne({ tenantId: cred.tenantId }).lean();
  if (!tenant) {
    return Errors.invalidCreds();
  }
  if (tenant.status === 'pending_deletion' || tenant.status === 'deleted') {
    return Errors.tenantDeleted();
  }
  if (tenant.status === 'suspended') {
    return Errors.tenantSuspended();
  }

  if (keyType === 'admin') {
    return {
      resolved: { kind: 'admin', tenantId: tenant.tenantId, tenantStatus: tenant.status, plan: tenant.plan },
      requestId: requestId ?? '',
    };
  }
  if (keyType === 'approval-proxy') {
    return {
      resolved: { kind: 'approval-proxy', tenantId: tenant.tenantId, tenantStatus: tenant.status, plan: tenant.plan },
      requestId: requestId ?? '',
    };
  }

  // Agent key: X-Agent-Id MUST match the record's agentId (ME-MT-6 / MT-008).
  if (!presentedAgentId || presentedAgentId !== cred.agentId) {
    return Errors.invalidCreds();
  }
  // Defensive: agent record must exist.
  const agent = await Agent.findOne({ tenantId: cred.tenantId, agentId: cred.agentId }).lean();
  if (!agent) {
    return Errors.invalidCreds();
  }

  return {
    resolved: {
      kind: 'agent',
      tenantId: tenant.tenantId,
      agentId: cred.agentId as string,
      tenantStatus: tenant.status,
      plan: tenant.plan,
    },
    requestId: requestId ?? '',
  };
}

/**
 * Require an agent key (tool endpoints). Admin keys are rejected with
 * ADMIN_KEY_REQUIRED semantics — but per PRD MT-007 the code is ADMIN_KEY_REQUIRED
 * 403 when an admin key hits a tool endpoint. We translate: an admin key on a
 * tool endpoint returns 403 ADMIN_KEY_REQUIRED.
 */
export async function requireAgentKey(req: NextRequest): Promise<Resolution | ApiError> {
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey) {
    return Errors.adminRequired();
  }
  return resolveCredentials(req, { allowAgentKey: true });
}

/**
 * Approve/reject endpoints accept admin key OR approval-proxy key.
 */
export async function requireApprovalOrAdmin(req: NextRequest): Promise<Resolution | ApiError> {
  const adminKey = req.headers.get('x-admin-key');
  const approvalKey = req.headers.get('x-approval-key');
  if (!adminKey && !approvalKey) {
    return Errors.forbidden('Tenant admin key or approval-proxy key required');
  }
  if (adminKey) return resolveCredentials(req, { requireAdminKey: true });
  return resolveCredentials(req, { requireApprovalKey: true });
}
