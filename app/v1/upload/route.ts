import { NextRequest } from 'next/server';
import { requireAgentKey } from '@/lib/v2/auth';
import { isApiError } from '@/lib/v2/errors';
import { ok, errorResponse } from '@/lib/v2/envelope';
import { Errors } from '@/lib/v2/errors';
import { uploadFile } from '@/lib/storage';
import { validateImage } from '@/lib/image-upload';

/**
 * Default retention for uploaded images (24 hours). Callers may override via
 * the `retentionHours` form field.
 */
const DEFAULT_RETENTION_HOURS = 24;

/**
 * POST /v1/upload — store an image in B2 and return a hosted URL.
 *
 * Auth: v2 agent key (`x-agent-id` + `x-api-key`). Tenant isolation is enforced
 * by the resolved identity; the returned file id is a capability token.
 *
 * Body: multipart/form-data with a `file` field (image/jpeg|png|webp|gif|avif|svg+xml) and
 * an optional `retentionHours` numeric field (default 24).
 *
 * @returns 201 `{ data: { id, url, filename, contentType, size, expiresAt }, meta: { request_id } }`
 */
export async function POST(request: NextRequest) {
  const resolution = await requireAgentKey(request);
  if (isApiError(resolution)) return errorResponse(resolution);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(Errors.validation('Request body must be multipart/form-data.'));
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return errorResponse(Errors.validation('Missing "file" field in multipart form data.'));
  }

  const validation = validateImage(file.type, file.size);
  if (!validation.valid) {
    return errorResponse(Errors.validation(validation.error));
  }

  const rawRetention = form.get('retentionHours');
  let retentionHours = DEFAULT_RETENTION_HOURS;
  if (rawRetention !== null) {
    const parsed = Number(rawRetention);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return errorResponse(Errors.validation('retentionHours must be a positive number.'));
    }
    retentionHours = parsed;
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(buffer, file.name, file.type, retentionHours);
    return ok(result, { status: 201 });
  } catch (err) {
    console.error('Image upload error:', err);
    return errorResponse(Errors.internal());
  }
}
