import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { validateApiKey, authErrorResponse, incrementQuota } from '@/lib/auth';
import { type TierName } from '@/lib/pricing';
import { successResponse } from '@/lib/response';
import { v4 as uuidv4 } from 'uuid';
import PiiSession from '@/models/PiiSession';

// PII detection patterns
const PII_PATTERNS = [
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, prefix: 'EMAIL' },
  { type: 'phone', pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, prefix: 'PHONE' },
  { type: 'ssn', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, prefix: 'SSN' },
  { type: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, prefix: 'CC' },
  { type: 'ip_address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, prefix: 'IP' },
  { type: 'date_dob', pattern: /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g, prefix: 'DATE' },
];

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request, { skipQuota: true });
  if (!authResult.success) return authErrorResponse(authResult);

  await incrementQuota(authResult.apiKey.userId, authResult.apiKey.tier as TierName);

  try {
    const body = await request.json();
    const { text, ttlHours } = body;

    if (!text) {
      return successResponse({ error: 'Missing "text" field' }, 400);
    }

    let cleaned = text;
    const mappings = new Map<string, string>();
    let counter = 0;

    for (const { pattern, prefix } of PII_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of [...new Set(matches)]) {
          counter++;
          const placeholder = `[${prefix}_${counter}]`;
          mappings.set(placeholder, match as string);
          cleaned = cleaned.replaceAll(match, placeholder);
        }
      }
    }

    // Store mappings in session
    const hours = ttlHours || 1;
    const sessionId = uuidv4();

    await connectDB();
    await PiiSession.create({
      _id: sessionId,
      userId: authResult.apiKey.userId,
      apiKeyId: authResult.apiKey._id,
      mappings,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    });

    return successResponse({
      sessionId,
      cleaned,
      detectionsFound: mappings.size,
      types: [...new Set([...mappings.keys()].map(k => k.match(/\[(\w+)_/)?.[1]))].filter(Boolean),
    }, 201);
  } catch (err) {
    console.error('PII clean error:', err);
    return successResponse({ error: 'Failed to clean PII' }, 500);
  }
}
