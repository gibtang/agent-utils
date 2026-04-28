import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ApiKey from '@/models/ApiKey';
import User from '@/models/User';

// GET /api/keys — List API keys for a user (requires Firebase token)
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    // In production, verify Firebase token here
    // For now, use token as firebaseUid for simplicity
    const firebaseUid = token;

    await connectDB();
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const keys = await ApiKey.find({ userId: user._id, active: true })
      .select('-key') // Don't return full key
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: keys });
  } catch (error) {
    console.error('List keys error:', error);
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 });
  }
}

// POST /api/keys — Create new API key
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const firebaseUid = token;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await connectDB();
    let user = await User.findOne({ firebaseUid });

    if (!user) {
      // Auto-create user on first key creation
      user = await User.create({ firebaseUid, email: `${firebaseUid}@agentutils.dev`, tier: 'free' });
    }

    // Limit: max 5 keys per user on free tier
    const keyCount = await ApiKey.countDocuments({ userId: user._id, active: true });
    if (keyCount >= 5 && user.tier === 'free') {
      return NextResponse.json({ error: 'Maximum 5 API keys on free tier' }, { status: 400 });
    }

    const apiKey = await ApiKey.create({
      userId: user._id,
      name,
      tier: user.tier,
    });

    // Return the full key ONLY on creation
    return NextResponse.json({
      success: true,
      data: {
        id: apiKey._id,
        name: apiKey.name,
        key: apiKey.key, // Full key — show once!
        tier: apiKey.tier,
        createdAt: apiKey.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create key error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
