/**
 * AgentUtils v2 — response envelope helpers (PRD §5.3).
 *
 * Success single:   { data: {...}, meta: { request_id } }
 * Success list:     { data: [...], meta: { request_id, cursor, has_more } }
 * Error:            { error: { code, message, details?, request_id } }
 *
 * Every response also includes rate-limit headers and a request_id.
 */
import { NextResponse } from 'next/server';
import { ApiError } from './errors';
import { requestId as newRequestId } from './ids';

export interface RateLimitHeaders {
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
}

function applyHeaders(res: NextResponse, reqId: string, rl?: RateLimitHeaders): NextResponse {
  res.headers.set('x-request-id', reqId);
  if (rl) {
    res.headers.set('X-RateLimit-Limit', String(rl.limit));
    res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    res.headers.set('X-RateLimit-Reset', String(rl.reset));
  }
  return res;
}

export function ok(
  data: unknown,
  opts: { status?: number; request_id?: string; rateLimit?: RateLimitHeaders; cursor?: string; has_more?: boolean } = {},
): NextResponse {
  const reqId = opts.request_id ?? newRequestId();
  const meta: Record<string, unknown> = { request_id: reqId };
  if (opts.cursor !== undefined) meta.cursor = opts.cursor;
  if (opts.has_more !== undefined) meta.has_more = opts.has_more;
  const body: Record<string, unknown> = { data, meta };
  const res = NextResponse.json(body, { status: opts.status ?? 200 });
  return applyHeaders(res, reqId, opts.rateLimit);
}

export function created(
  data: unknown,
  opts: { request_id?: string; rateLimit?: RateLimitHeaders } = {},
): NextResponse {
  return ok(data, { status: 201, ...opts });
}

export function noContent(
  opts: { request_id?: string; rateLimit?: RateLimitHeaders } = {},
): NextResponse {
  const reqId = opts.request_id ?? newRequestId();
  const res = new NextResponse(null, { status: 204 });
  return applyHeaders(res, reqId, opts.rateLimit);
}

export function errorResponse(
  err: ApiError,
  opts: { request_id?: string; rateLimit?: RateLimitHeaders } = {},
): NextResponse {
  const reqId = opts.request_id ?? newRequestId();
  const res = NextResponse.json(err.toJSON(reqId), { status: err.http });
  return applyHeaders(res, reqId, opts.rateLimit);
}
