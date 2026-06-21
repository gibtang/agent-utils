/**
 * AgentUtils v2 — shared route handler wrapper.
 *
 * Ties together: credential resolution -> tenant status -> rate limit ->
 * idempotency -> handler(ctx) -> envelope. Catches ApiError and unknown errors.
 */
import type { NextRequest } from 'next/server';
import { ApiError, Errors } from './errors';
import { ok, created, noContent, errorResponse, type RateLimitHeaders } from './envelope';
import { resolveCredentials, requireAgentKey, type Resolved } from './auth';
import { checkRateLimit } from './rateLimit';
import { lookupIdempotency, storeIdempotency, readIdempotencyKey } from './idempotency';
import { requestId as generateRequestId } from './ids';

export interface RouteContext<TParams = Record<string, string | string[]>> {
  req: NextRequest;
  resolved: Resolved;
  body: unknown;
  requestId: string;
  params: TParams;
  rateLimit: RateLimitHeaders;
}

export type HandlerResult =
  | { kind: 'ok'; data: unknown; status?: number }
  | { kind: 'created'; data: unknown }
  | { kind: 'noContent' }
  | { kind: 'list'; data: unknown[]; cursor?: string; has_more: boolean };

export type Handler<TParams> = (ctx: RouteContext<TParams>) => Promise<HandlerResult | ApiError>;

export interface RouteOptions {
  /** Endpoint is admin-only (tenant management). */
  admin?: boolean;
  /** Endpoint requires an agent key (tool endpoints). Admin keys rejected. */
  agentKey?: boolean;
  /** Endpoint is public (tenant signup). No auth, no rate limit. */
  public?: boolean;
  /** Endpoint supports Idempotency-Key replay. */
  idempotent?: string;
  /** Bypass per-tenant rate limit. */
  skipRateLimit?: boolean;
}

function isApiError(v: unknown): v is ApiError {
  return v instanceof ApiError;
}

function toNextResponse(
  result: HandlerResult | ApiError,
  requestId: string,
  rl: RateLimitHeaders | undefined,
): Response {
  if (isApiError(result)) return errorResponse(result, { request_id: requestId, rateLimit: rl });
  switch (result.kind) {
    case 'created':
      return created(result.data, { request_id: requestId, rateLimit: rl });
    case 'noContent':
      return noContent({ request_id: requestId, rateLimit: rl });
    case 'list':
      return ok(result.data, {
        request_id: requestId,
        rateLimit: rl,
        cursor: result.cursor,
        has_more: result.has_more,
      });
    case 'ok':
    default:
      return ok(result.data, { status: result.status, request_id: requestId, rateLimit: rl });
  }
}

async function parseBody(req: NextRequest): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') return undefined;
    return JSON.parse(text);
  } catch {
    throw Errors.validation('Invalid JSON body');
  }
}

async function resolveParams(segmentParams: unknown): Promise<Record<string, string | string[]>> {
  if (!segmentParams) return {};
  const maybe = segmentParams as { params?: Promise<Record<string, string | string[]>> | Record<string, string | string[]> };
  if (maybe.params && typeof maybe.params === 'object' && 'then' in (maybe.params as object)) {
    return (await maybe.params) as Record<string, string | string[]>;
  }
  if (maybe.params) return maybe.params as Record<string, string | string[]>;
  return segmentParams as Record<string, string | string[]>;
}

export function createRoute<TParams extends Record<string, string | string[]> = {}>(
  options: RouteOptions,
  handler: Handler<TParams>,
) {
  return async (req: NextRequest, segmentParams?: unknown): Promise<Response> => {
    let requestId = '';
    try {
      const params = (await resolveParams(segmentParams)) as TParams;

      // Auth
      let resolution: Awaited<ReturnType<typeof resolveCredentials>>;
      if (options.public) {
        resolution = { resolved: { kind: 'admin', tenantId: '', tenantStatus: 'active', plan: 'free' }, requestId: '' };
      } else if (options.agentKey) {
        resolution = await requireAgentKey(req);
      } else {
        resolution = await resolveCredentials(req, { requireAdminKey: options.admin });
      }
      if (resolution instanceof ApiError) {
        return errorResponse(resolution, { request_id: requestId || undefined });
      }
      const resolved = resolution.resolved;
      requestId = resolution.requestId || req.headers.get('x-request-id') || '';

      // Rate limit (per-tenant).
      let rl: RateLimitHeaders | undefined;
      if (!options.public && !options.skipRateLimit && resolved.tenantId) {
        const rlResult = await checkRateLimit(resolved.tenantId, resolved.plan);
        rl = rlResult.headers;
        if (!rlResult.allowed) {
          return errorResponse(Errors.rateLimited(rlResult.retryAfterSeconds ?? 1), {
            request_id: requestId || undefined,
            rateLimit: rl,
          });
        }
      }

      // Body
      let body: unknown;
      try {
        body = await parseBody(req);
      } catch (e) {
        return errorResponse(e instanceof ApiError ? e : Errors.internal(), {
          request_id: requestId || undefined,
          rateLimit: rl,
        });
      }

      // Idempotency. Public tenant-creation is scoped by a synthetic tenant id.
      const idemScope = options.public ? '__public__' : resolved.tenantId;
      if (options.idempotent && idemScope) {
        const idemKey = readIdempotencyKey(req);
        if (idemKey) {
          const looked = await lookupIdempotency(idemScope, options.idempotent, idemKey, body);
          if (looked.kind === 'conflict') {
            return errorResponse(Errors.conflict('Idempotency-Key reused with a different request body'), {
              request_id: requestId || undefined,
              rateLimit: rl,
            });
          }
          if (looked.kind === 'inflight') {
            return errorResponse(Errors.conflict('Idempotent request already in progress'), {
              request_id: requestId || undefined,
              rateLimit: rl,
            });
          }
          if (looked.kind === 'replay') {
            const replayBody = looked.body as { data: unknown; meta?: Record<string, unknown> };
            return ok(replayBody.data, {
              status: looked.status,
              request_id: requestId || undefined,
              rateLimit: rl,
              ...(replayBody.meta?.cursor ? { cursor: replayBody.meta.cursor as string } : {}),
              ...(replayBody.meta?.has_more !== undefined ? { has_more: replayBody.meta.has_more as boolean } : {}),
            });
          }
        }
      }

      const ctx: RouteContext<TParams> = { req, resolved, body, requestId, params, rateLimit: rl as RateLimitHeaders };
      const result = await handler(ctx);

      // Persist idempotency snapshot for non-5xx outcomes.
      if (options.idempotent && idemScope) {
        const idemKey = readIdempotencyKey(req);
        if (idemKey) {
          const snapshot = isApiError(result)
            ? { data: null, error: result.toJSON(requestId || '0') }
            : result.kind === 'list'
              ? { data: result.data, meta: { cursor: result.cursor, has_more: result.has_more } }
              : result.kind === 'noContent'
                ? { data: null }
                : { data: result.data };
          const status = isApiError(result)
            ? result.http
            : result.kind === 'created'
              ? 201
              : result.kind === 'noContent'
                ? 204
                : result.kind === 'ok'
                  ? result.status ?? 200
                  : 200;
          if (status < 500) {
            await storeIdempotency(idemScope, options.idempotent, idemKey, body, status, snapshot);
          }
        }
      }

      return toNextResponse(result, requestId || generateRequestId(), rl);
    } catch (e) {
      const err = e instanceof ApiError ? e : Errors.internal();
      // eslint-disable-next-line no-console
      console.error('[v2 route error]', e);
      return errorResponse(err, { request_id: requestId || undefined });
    }
  };
}
