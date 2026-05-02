import { NextRequest, NextResponse } from 'next/server';
import { getFile } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getFile(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'File not found or expired', code: 'HTTP_404', url: process.env.NEXT_PUBLIC_APP_URL },
        { status: 404 }
      );
    }

    // Return the file with proper content type
    return new NextResponse(new Uint8Array(result.data), {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `inline; filename="${result.metadata.originalname || 'file'}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve file', url: process.env.NEXT_PUBLIC_APP_URL },
      { status: 500 }
    );
  }
}
