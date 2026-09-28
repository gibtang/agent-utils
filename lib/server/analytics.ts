import type { NextRequest } from 'next/server';

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const CONSENT_COOKIE = 'agent_utils_analytics_consent';

/** Read GA4's first-party client id without accepting arbitrary identifiers. */
function getGaClientId(request: NextRequest): string | null {
  const value = request.cookies.get('_ga')?.value;
  if (!value) return null;
  const match = value.match(/^GA\d+\.\d+\.(\d+\.\d+)$/);
  return match?.[1] ?? null;
}

/** Keep dynamic IDs, slugs, and customer-controlled path values out of GA4. */
function getApiResource(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('v1');
  if (apiIndex < 0) return 'unknown';
  const resource = segments[apiIndex + 1];
  return resource && /^[a-z][a-z0-9-]{0,40}$/.test(resource) ? resource : 'unknown';
}

/**
 * Best-effort server-side success measurement for consented browser calls.
 * API-key clients and requests without consent, a GA client id, or the
 * optional Measurement Protocol configuration are deliberately ignored.
 */
export async function emitApiCallSucceeded(
  request: NextRequest,
  responseStatus: number,
): Promise<void> {
  if (request.cookies.get(CONSENT_COOKIE)?.value !== 'accepted') return;

  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_MP_API_SECRET;
  const clientId = getGaClientId(request);
  if (!measurementId || !apiSecret || !clientId) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          client_id: clientId,
          events: [{
            name: 'api_call_succeeded',
            params: {
              api_resource: getApiResource(request),
              http_method: request.method,
              response_status: responseStatus,
              engagement_time_msec: 1,
            },
          }],
        }),
      },
    );
  } catch {
    // Analytics must never make an API request fail.
  } finally {
    clearTimeout(timeout);
  }
}
