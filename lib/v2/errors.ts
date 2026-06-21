/**
 * AgentUtils v2 — error catalogue.
 *
 * Maps PRD error codes to HTTP status + message. See PRD §5.7.
 */

export interface ApiErrorDetail {
  code: string;
  http: number;
  message: string;
}

export const ErrorCode = {
  MISSING_AUTH_HEADERS: 'MISSING_AUTH_HEADERS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ADMIN_KEY_REQUIRED: 'ADMIN_KEY_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  GONE: 'GONE',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_DELETED: 'TENANT_DELETED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  NAMESPACE_FORBIDDEN: 'NAMESPACE_FORBIDDEN',
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  SCHEDULE_ALREADY_CANCELLED: 'SCHEDULE_ALREADY_CANCELLED',
  DLQ_ITEM_NOT_FOUND: 'DLQ_ITEM_NOT_FOUND',
  DLQ_ITEM_LOCKED: 'DLQ_ITEM_LOCKED',
  DLQ_ITEM_ALREADY_RESOLVED: 'DLQ_ITEM_ALREADY_RESOLVED',
  CHECKPOINT_NOT_FOUND: 'CHECKPOINT_NOT_FOUND',
  CHECKPOINT_ALREADY_RESOLVED: 'CHECKPOINT_ALREADY_RESOLVED',
  AGENT_NAME_TAKEN: 'AGENT_NAME_TAKEN',
  TENANT_NAME_TAKEN: 'TENANT_NAME_TAKEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ApiError extends Error {
  readonly code: string;
  readonly http: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, http: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.http = http;
    if (details) this.details = details;
  }

  /** Helper: attach a request_id-free body; request_id merged in by envelope. */
  toJSON(requestId: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
        request_id: requestId,
      },
    };
  }
}

export function apiError(
  code: string,
  message: string,
  http: number,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError(code, message, http, details);
}

/** Standard factories. */
export const Errors = {
  missingAuth: () => apiError(ErrorCode.MISSING_AUTH_HEADERS, 'Required auth header(s) missing', 401),
  invalidCreds: () => apiError(ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials', 401),
  adminRequired: () => apiError(ErrorCode.ADMIN_KEY_REQUIRED, 'Admin key required for this endpoint', 403),
  forbidden: (msg = 'Forbidden') => apiError(ErrorCode.FORBIDDEN, msg, 403),
  notFound: (msg = 'Not found') => apiError(ErrorCode.NOT_FOUND, msg, 404),
  keyNotFound: () => apiError(ErrorCode.KEY_NOT_FOUND, 'KV key does not exist', 404),
  versionMismatch: (currentVersion: number) =>
    apiError(ErrorCode.VERSION_MISMATCH, 'CAS version mismatch', 409, { current_version: currentVersion }),
  namespaceForbidden: () => apiError(ErrorCode.NAMESPACE_FORBIDDEN, 'Agent cannot access this KV namespace', 403),
  gone: (msg = 'Gone') => apiError(ErrorCode.GONE, msg, 410),
  tenantSuspended: () => apiError(ErrorCode.TENANT_SUSPENDED, 'Tenant account is suspended', 402),
  tenantDeleted: () => apiError(ErrorCode.TENANT_DELETED, 'Tenant has been deleted', 410),
  validation: (msg: string, details?: Record<string, unknown>) =>
    apiError(ErrorCode.VALIDATION_ERROR, msg || 'Validation error', 400, details),
  payloadTooLarge: (msg = 'Payload too large') => apiError(ErrorCode.PAYLOAD_TOO_LARGE, msg, 413),
  conflict: (msg: string, details?: Record<string, unknown>) =>
    apiError(ErrorCode.CONFLICT, msg, 409, details),
  tenantNameTaken: () => apiError(ErrorCode.TENANT_NAME_TAKEN, 'Tenant name already registered', 409),
  agentNameTaken: () => apiError(ErrorCode.AGENT_NAME_TAKEN, 'Agent name already exists in this tenant', 409),
  rateLimited: (retryAfterSeconds: number) =>
    apiError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded', 429, { retry_after_seconds: retryAfterSeconds }),
  quotaExceeded: (quota: string, used?: number, limit?: number) =>
    apiError(
      ErrorCode.QUOTA_EXCEEDED,
      'Tenant resource quota exceeded',
      429,
      { quota, ...(used !== undefined ? { used } : {}), ...(limit !== undefined ? { limit } : {}) },
    ),
  internal: (msg = 'Internal server error') => apiError(ErrorCode.INTERNAL_ERROR, msg, 500),
};
