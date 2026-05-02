import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

export async function GET() {
  let dbStatus = 'disconnected';

  try {
    const mongoose = await connectDB();
    dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'error';
  }

  return NextResponse.json({
    status: 'ok',
    db: dbStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    url: process.env.NEXT_PUBLIC_APP_URL,
  });
}
