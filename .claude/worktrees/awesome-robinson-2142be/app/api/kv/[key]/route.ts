import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import KvEntry from '@/models/KvEntry';

// GET /api/kv/:key — Get a single value
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    await connectDB();

    const entry = await KvEntry.findOne({
      apiKeyId: authResult.apiKey._id,
      key: decodedKey,
    });

    if (!entry) {
      return errorResponse('Key not found', 404);
    }

    return successResponse({
      key: entry.key,
      value: entry.value,
      expiresAt: entry.expiresAt,
    });
  } catch (err) {
    console.error('KV GET error:', err);
    return errorResponse('Failed to get key', 500);
  }
}

// DELETE /api/kv/:key — Delete a key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    await connectDB();

    const entry = await KvEntry.findOneAndDelete({
      apiKeyId: authResult.apiKey._id,
      key: decodedKey,
    });

    if (!entry) {
      return errorResponse('Key not found', 404);
    }

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('KV DELETE error:', err);
    return errorResponse('Failed to delete key', 500);
  }
}
