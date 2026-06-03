import { NextRequest, NextResponse } from 'next/server';

// Relay Vercel deployment webhooks → ntfy.sh/gibtang-vercel-events
// Vercel webhook payload: https://vercel.com/docs/webhooks/webhooks-api

const NTFY_URL = 'https://ntfy.sh/gibtang-vercel-events';

// Map Vercel event types to human-readable status
const STATUS_MAP: Record<string, string> = {
  'deployment.created': 'created',
  'deployment.succeeded': 'successful',
  'deployment.ready': 'ready',
  'deployment.error': 'failed',
  'deployment.canceled': 'canceled',
  'deployment.promoted': 'promoted',
  'deployment.check-rerequested': 'check rerequested',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Vercel sends { type, payload: { deployment, project, ... } }
    const eventType = body?.type ?? 'unknown';
    const project = body?.payload?.project?.name
      ?? body?.payload?.deployment?.meta?.githubRepo
      ?? 'unknown-project';
    const status = STATUS_MAP[eventType] ?? eventType;

    const message = `${project} deployment status is ${status}`;

    // Forward to ntfy.sh
    const res = await fetch(NTFY_URL, {
      method: 'POST',
      body: message,
      headers: { 'Content-Type': 'text/plain' },
    });

    if (!res.ok) {
      console.error(`ntfy.sh returned ${res.status}: ${await res.text()}`);
      return NextResponse.json({ error: 'ntfy.sh failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, message });
  } catch (err) {
    console.error('vercel-ntfy relay error:', err);
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
