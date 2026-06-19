import { NextRequest } from 'next/server';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { uploadFile } from '@/lib/storage';
import { validateImage } from '@/lib/image-upload';

/**
 * Default retention for uploaded images (24 hours). Callers may override via
 * the `retentionHours` form field.
 */
const DEFAULT_RETENTION_HOURS = 24;

/**
 * POST /api/upload — store an image in B2 and return a hosted URL.
 *
 * Auth: `x-api-key` header.
 * Body: multipart/form-data with a `file` field (image/jpeg|png|webp|gif) and
 * an optional `retentionHours` numeric field (default 24).
 *
 * @returns 201 `{ success, data: { id, url, filename, contentType, size, expiresAt } }`
 */
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse('Request body must be multipart/form-data.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return errorResponse('Missing "file" field in multipart form data.', 400);
  }

  const validation = validateImage(file.type, file.size);
  if (!validation.valid) {
    return errorResponse(validation.error, validation.statusCode);
  }

  const rawRetention = form.get('retentionHours');
  let retentionHours = DEFAULT_RETENTION_HOURS;
  if (rawRetention !== null) {
    const parsed = Number(rawRetention);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return errorResponse('retentionHours must be a positive number.', 400);
    }
    retentionHours = parsed;
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(buffer, file.name, file.type, retentionHours);
    return successResponse(result, 201);
  } catch (err) {
    console.error('Image upload error:', err);
    return errorResponse('Failed to store image.', 500);
  }
}
