export type PublicErrorBody = { error: { code: string; message: string; data_preserved: boolean; retry_safe: boolean; next_action: string; request_id: string } };
type Details = Record<string, unknown>;
type ErrorOverrides = { message?: string; details?: Details };

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly http: number,
    public readonly dataPreserved: boolean,
    public readonly retrySafe: boolean,
    public readonly nextAction: string,
    public readonly details?: Details,
  ) { super(message); this.name = 'DomainError'; }

  toBody(requestId: string): PublicErrorBody {
    return { error: { code: this.code, message: this.message, data_preserved: this.dataPreserved, retry_safe: this.retrySafe, next_action: this.nextAction, request_id: requestId } };
  }
}

type CatalogueEntry = { http: number; message: string; dataPreserved: boolean; retrySafe: boolean; nextAction: string; factory: string };
/** Stable public error contract. plan_limit_reached is 429 so callers can retry after upgrading or later. */
export const ERROR_CATALOGUE = {
  authentication_required: { http: 401, message: 'Authentication is required.', dataPreserved: true, retrySafe: false, nextAction: 'Provide valid credentials and try again.', factory: 'authenticationRequired' },
  connection_revoked: { http: 403, message: 'This connection has been revoked.', dataPreserved: true, retrySafe: false, nextAction: 'Create or authorize a new connection.', factory: 'connectionRevoked' },
  permission_denied: { http: 403, message: 'You do not have permission to perform this action.', dataPreserved: true, retrySafe: false, nextAction: 'Request the required permission and try again.', factory: 'permissionDenied' },
  source_verification_failed: { http: 401, message: 'The source could not be verified.', dataPreserved: true, retrySafe: false, nextAction: 'Check the source credentials and try again.', factory: 'sourceVerificationFailed' },
  validation_failed: { http: 400, message: 'Some submitted values are invalid.', dataPreserved: true, retrySafe: false, nextAction: 'Correct the submitted values and try again.', factory: 'validationFailed' },
  payload_too_large: { http: 413, message: 'The submitted payload is too large.', dataPreserved: true, retrySafe: false, nextAction: 'Reduce the payload size and try again.', factory: 'payloadTooLarge' },
  plan_limit_reached: { http: 429, message: 'Your plan limit has been reached.', dataPreserved: true, retrySafe: false, nextAction: 'Upgrade your plan or wait for the limit to reset.', factory: 'planLimitReached' },
  version_conflict: { http: 409, message: 'This item changed before your update could be applied.', dataPreserved: true, retrySafe: true, nextAction: 'Refresh the item, review changes, and retry.', factory: 'versionConflict' },
  claim_conflict: { http: 409, message: 'This item is already claimed.', dataPreserved: true, retrySafe: true, nextAction: 'Refresh the item and choose another available item.', factory: 'claimConflict' },
  claim_expired: { http: 410, message: 'This claim has expired.', dataPreserved: true, retrySafe: false, nextAction: 'Create a new claim before continuing.', factory: 'claimExpired' },
  resource_deleted: { http: 410, message: 'This resource has been deleted.', dataPreserved: false, retrySafe: false, nextAction: 'Create a new resource if you still need one.', factory: 'resourceDeleted' },
  resource_expired: { http: 410, message: 'This resource has expired.', dataPreserved: true, retrySafe: false, nextAction: 'Create or request a new resource.', factory: 'resourceExpired' },
  not_found: { http: 404, message: 'The requested resource was not found.', dataPreserved: true, retrySafe: false, nextAction: 'Check the resource identifier and try again.', factory: 'notFound' },
  temporarily_unavailable: { http: 503, message: 'The service is temporarily unavailable.', dataPreserved: true, retrySafe: true, nextAction: 'Wait briefly and try again.', factory: 'temporarilyUnavailable' },
} as const satisfies Record<string, CatalogueEntry>;

function make(code: keyof typeof ERROR_CATALOGUE, overrides: ErrorOverrides = {}): DomainError {
  const entry = ERROR_CATALOGUE[code];
  return new DomainError(code, overrides.message ?? entry.message, entry.http, entry.dataPreserved, entry.retrySafe, entry.nextAction, overrides.details);
}
export const Errors = {
  authenticationRequired: (o?: ErrorOverrides) => make('authentication_required', o), connectionRevoked: (o?: ErrorOverrides) => make('connection_revoked', o), permissionDenied: (o?: ErrorOverrides) => make('permission_denied', o), sourceVerificationFailed: (o?: ErrorOverrides) => make('source_verification_failed', o), validationFailed: (o?: ErrorOverrides) => make('validation_failed', o), payloadTooLarge: (o?: ErrorOverrides) => make('payload_too_large', o), planLimitReached: (o?: ErrorOverrides) => make('plan_limit_reached', o), versionConflict: (o?: ErrorOverrides) => make('version_conflict', o), claimConflict: (o?: ErrorOverrides) => make('claim_conflict', o), claimExpired: (o?: ErrorOverrides) => make('claim_expired', o), resourceDeleted: (o?: ErrorOverrides) => make('resource_deleted', o), resourceExpired: (o?: ErrorOverrides) => make('resource_expired', o), notFound: (o?: ErrorOverrides) => make('not_found', o), temporarilyUnavailable: (o?: ErrorOverrides) => make('temporarily_unavailable', o),
};
