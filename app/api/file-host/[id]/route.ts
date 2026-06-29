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

  const contentType = file.contentType || 'application/octet-stream';

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    // Images are immutable per-id; allow browser/CDN caching.
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  // SVG can carry <script> and event handlers. When an SVG is loaded via
  // <img> the browser disables script execution, so embedding stays safe —
  // but navigating directly to the SVG URL would render it as a document and
  // run any embedded scripts on this origin. Force a download on direct
  // navigation to neutralize that XSS vector. <img>/<picture> embedding is
  // unaffected by Content-Disposition.
  if (contentType === 'image/svg+xml') {
    headers['Content-Disposition'] = 'attachment';
    headers['Content-Security-Policy'] = "default-src 'none'";
  }

  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers,
  });
}
