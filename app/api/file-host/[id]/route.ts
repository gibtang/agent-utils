import { NextRequest, NextResponse } from 'next/server';
import { getFile } from '@/lib/storage';

/**
 * GET /api/file-host/[id] — publicly serve a previously uploaded file.
 *
 * No `x-api-key` required: the opaque `id` acts as a capability token.
 * Files past their stored `expiresAt` are treated as gone (getFile returns
 * null) and surface as a 404.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let file: { data: Buffer; contentType: string; metadata: Record<string, string> } | null;
  try {
    file = await getFile(id);
  } catch (err) {
    console.error('file-host fetch error:', err);
    file = null;
  }

  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers: {
      'Content-Type': file.contentType || 'application/octet-stream',
      // Images are immutable per-id; allow browser/CDN caching.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
