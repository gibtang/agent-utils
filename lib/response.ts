import { NextResponse } from 'next/server';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data, url: baseUrl }, { status });
}

export function errorResponse(message: string, status = 400, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code || `HTTP_${status}`,
      url: baseUrl,
    },
    { status }
  );
}
