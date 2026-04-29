import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import AgentForm from '@/models/AgentForm';
import FormResponse from '@/models/FormResponse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const form = await AgentForm.findOne({ token: id }).lean();
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const now = new Date();
    if (form.status !== 'active' || (form.expiresAt && form.expiresAt < now)) {
      return NextResponse.json({ error: 'Form no longer available' }, { status: 410 });
    }

    // Parse form data (support both JSON and form-urlencoded)
    const contentType = request.headers.get('content-type') || '';
    let data: Record<string, unknown> = {};

    if (contentType.includes('application/json')) {
      data = await request.json();
    } else {
      // form-urlencoded
      const formData = await request.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    }

    // Get source IP
    const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';

    // Store response
    await FormResponse.create({
      formId: form._id,
      data,
      sourceIp,
    });

    // Increment response count atomically
    await AgentForm.updateOne({ _id: form._id }, { $inc: { responseCount: 1 } });

    // Fire webhook (fire-and-forget)
    if (form.webhookUrl) {
      fetch(form.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId: form._id, formTitle: form.title, data, submittedAt: new Date().toISOString() }),
      }).catch(() => {});
    }

    // Return a simple thank-you HTML page
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank You</title><style>body{background:#09090b;color:#f4f4f5;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}div{text-align:center}h1{font-size:1.5rem}p{color:#a1a1aa;margin-top:.5rem}</style></head><body><div><h1>Thank you!</h1><p>Your response has been recorded.</p></div></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err) {
    console.error('Form submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
