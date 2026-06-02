import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { errorResponse } from '@/lib/response';
import OtpSession from '@/models/OtpSession';

/**
 * POST /api/otp/webhook — Twilio webhook to receive incoming SMS
 *
 * This endpoint is called by Twilio when an SMS arrives at the
 * provisioned phone number. It extracts the OTP code and updates
 * the session.
 *
 * Security: Validate Twilio signature in production.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let from: string | undefined;
    let to: string | undefined;
    let body: string | undefined;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      from = formData.get('From') as string;
      to = formData.get('To') as string;
      body = formData.get('Body') as string;
    } else {
      const json = await request.json();
      from = json.From;
      to = json.To;
      body = json.Body;
    }

    if (!body) {
      return errorResponse('Missing message body', 400);
    }

    // Extract OTP code: look for 4-8 digit sequences
    const codePatterns = [
      /(?:code|verify|verification|otp|pin)[:\s]*(\d{4,8})/i,
      /\b(\d{4,8})\b/,
    ];

    let extractedCode: string | null = null;
    for (const pattern of codePatterns) {
      const match = body.match(pattern);
      if (match) {
        extractedCode = match[1];
        break;
      }
    }

    if (!extractedCode) {
      console.log('Could not extract OTP code from message:', body);
      // Still store the raw body even if we can't parse a code
    }

    await connectDB();

    // Find the earliest waiting session and update it
    // Scope by phone number when available for multi-tenant safety
    const session = await OtpSession.findOneAndUpdate(
      {
        status: 'waiting',
        expiresAt: { $gt: new Date() },
        ...(to ? { phoneNumber: to } : {}),
      },
      {
        status: extractedCode ? 'received' : 'failed',
        code: extractedCode,
        codeBody: body,
        senderNumber: from,
        receivedAt: new Date(),
      },
      { sort: { createdAt: 1 }, new: true }
    ).lean();

    if (!session) {
      return errorResponse('No active OTP session found', 404);
    }

    // Return empty TwiML to acknowledge receipt
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (error) {
    console.error('OTP webhook error:', error);
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
