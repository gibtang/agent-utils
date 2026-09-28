import { DomainError, type PublicErrorBody } from './errors';

export type ResponseEnvelope<T> = { status: number; body: { data: T; request_id: string }; headers?: HeadersInit };
export type FailureEnvelope = { status: number; body: PublicErrorBody; headers?: HeadersInit };

/** Framework-agnostic HTTP response data; route adapters may pass it to NextResponse.json. */
export function success<T>(data: T, requestId: string, init: { status?: number; headers?: HeadersInit } = {}): ResponseEnvelope<T> {
  return { status: init.status ?? 200, body: { data, request_id: requestId }, ...(init.headers ? { headers: init.headers } : {}) };
}

export function failure(error: DomainError, requestId: string): FailureEnvelope {
  return { status: error.http, body: error.toBody(requestId) };
}
