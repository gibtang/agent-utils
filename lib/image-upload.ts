/**
 * Image upload validation for the AgentUtils image upload tool.
 *
 * Pure, side-effect-free helpers so the validation logic is unit-testable
 * without spinning up Next.js, the S3 client, or MongoDB.
 */

/** MIME types accepted by the image upload tool. */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  // SVG is XML and can carry <script>/event handlers. It is accepted because
  // SVGs loaded via <img> do not execute scripts; the file-host serving route
  // additionally forces `Content-Disposition: attachment` for SVGs so that
  // direct navigation downloads instead of executing embedded scripts.
  'image/svg+xml',
] as const;

/** Maximum accepted upload size (10 MiB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageValidationOk = { valid: true };
export type ImageValidationErr = {
  valid: false;
  error: string;
  statusCode: number;
};
export type ImageValidationResult = ImageValidationOk | ImageValidationErr;

/** Strip the `;` params from a content-type (e.g. `image/png; charset=binary`). */
function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

/**
 * Validate that a candidate upload is an allowed image within the size limit.
 *
 * @returns `{ valid: true }` or `{ valid: false, error, statusCode }`.
 * Status codes follow HTTP semantics:
 *   - 400 for a missing/empty payload
 *   - 413 for an oversized payload
 *   - 415 for an unsupported media type
 */
export function validateImage(
  contentType: string,
  size: number,
): ImageValidationResult {
  if (!Number.isFinite(size) || size <= 0) {
    return {
      valid: false,
      error: 'File is empty or missing.',
      statusCode: 400,
    };
  }

  if (size > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      error: `File exceeds the maximum size of ${MAX_IMAGE_BYTES} bytes.`,
      statusCode: 413,
    };
  }

  const type = normalizeContentType(contentType);
  if (!type) {
    return {
      valid: false,
      error: `Missing content type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}.`,
      statusCode: 415,
    };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      valid: false,
      error: `Unsupported content type "${type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}.`,
      statusCode: 415,
    };
  }

  return { valid: true };
}
