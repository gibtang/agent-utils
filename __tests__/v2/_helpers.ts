/**
 * AgentUtils v2 — shared test fixtures.
 *
 * Uses a real in-memory MongoDB (via __tests__/helpers/mongodb) so tenant
 * isolation is verified at the actual query layer — mocks cannot prove MT-001..010.
 */
import '../helpers/mongodb'; // boots MongoMemoryServer + connects mongoose
import Tenant from '@/models/v2/Tenant';
import Agent from '@/models/v2/Agent';
import ApiCredential from '@/models/v2/ApiCredential';
import { resourceId, generateAdminKey, generateAgentKey } from '@/lib/v2/ids';
import { randomSecret } from '@/lib/v2/crypto';

export interface TenantFix {
  tenantId: string;
  adminKey: string;
  name: string;
  plan: 'free' | 'pro';
  status: 'active' | 'suspended' | 'pending_deletion' | 'deleted';
}

export interface AgentFix {
  tenantId: string;
  agentId: string;
  apiKey: string;
}

export async function makeTenant(
  overrides: Partial<TenantFix> & { name: string } = { name: 'acme' },
): Promise<TenantFix> {
  const tenantId = overrides.tenantId ?? resourceId('ten_');
  const adminKey = generateAdminKey();
  const name = overrides.name;
  const plan = overrides.plan ?? 'free';
  const status = overrides.status ?? 'active';
  await Tenant.create({
    tenantId,
    name,
    ownerEmail: `owner-${name}@example.com`,
    plan,
    status,
    adminKey,
    callbackSecret: randomSecret(),
  });
  await ApiCredential.create({
    apiKey: adminKey,
    keyPrefix: 'agutil_adm_',
    keyType: 'admin',
    tenantId,
    agentId: null,
    active: true,
  });
  return { tenantId, adminKey, name, plan, status };
}

export async function makeAgent(
  tenantId: string,
  agentId: string = 'rx0',
  plan: 'free' | 'pro' = 'free',
): Promise<AgentFix> {
  const apiKey = generateAgentKey();
  await Agent.create({
    agentId,
    tenantId,
    apiKey,
  });
  await ApiCredential.create({
    apiKey,
    keyPrefix: 'agutil_agt_',
    keyType: 'agent',
    tenantId,
    agentId,
    active: true,
  });
  // bump tenant agentCount to reflect quota reality
  await Tenant.updateOne({ tenantId }, { $inc: { agentCount: 1 } });
  void plan;
  return { tenantId, agentId, apiKey };
}

export async function getTenantCallbackSecret(tenantId: string): Promise<string> {
  const t = await Tenant.findOne({ tenantId }).lean();
  return (t as { callbackSecret?: string } | null)?.callbackSecret ?? '';
}

/** Build a NextRequest-like object for calling route handlers directly. */
export function makeReq(
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
) {
  const url = new URL(`https://api.agentutils.io${path}`);
  const init: RequestInit & { method: string; headers: Record<string, string> } = {
    method,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  };
  if (opts.body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(opts.body);
  }
  return new Request(url, init) as unknown as import('next/server').NextRequest;
}

export async function call(
  handler: (req: import('next/server').NextRequest, params?: unknown) => Promise<Response>,
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string>; params?: Record<string, string | string[]> } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const req = makeReq(method, path, opts);
  const res = await handler(req, opts.params ? { params: Promise.resolve(opts.params) } : undefined);
  const text = await res.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
  }
  return { status: res.status, body, headers: res.headers };
}

export function adminHeaders(adminKey: string): Record<string, string> {
  return { 'x-admin-key': adminKey };
}
export function agentHeaders(agentId: string, apiKey: string): Record<string, string> {
  return { 'x-agent-id': agentId, 'x-api-key': apiKey };
}
