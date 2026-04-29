import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';
import { successResponse } from '@/lib/response';
import File from '@/models/File';
import { getTierConfig } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.success) return authErrorResponse(authResult);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const ttlHours = parseInt(formData.get('ttl') as string) || undefined;

    if (!file) {
      return successResponse({ error: 'No file provided. Use form field "file".' }, 400);
    }

    // Check file size against tier limits
    const tierConfig = getTierConfig(authResult.apiKey.tier as string);
    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > tierConfig.maxFileSize) {
      return successResponse({
        error: `File too large. ${tierConfig.maxFileSize / 1024 / 1024}MB max on ${authResult.apiKey.tier} tier.`
      }, 400);
    }

    // Determine retention
    const retention = ttlHours
      ? Math.min(ttlHours, tierConfig.fileRetentionHours)
      : tierConfig.fileRetentionHours;

    // Upload to B2
    const result = await uploadFile(buffer, file.name, file.type, retention);

    // Save metadata to MongoDB
    await connectDB();
    await File.create({
      storageId: result.id,
      userId: authResult.apiKey.userId,
      apiKeyId: authResult.apiKey._id,
      originalName: file.name,
      contentType: file.type,
      size: buffer.length,
      expiresAt: result.expiresAt,
    });

    return successResponse({
      id: result.id,
      url: result.url,
      filename: result.filename,
      contentType: result.contentType,
      size: result.size,
      expiresAt: result.expiresAt,
    }, 201);
  } catch (error) {
    console.error('File upload error:', error);
    return successResponse({ error: 'Upload failed' }, 500);
  }
}
