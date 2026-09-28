import { NextRequest } from 'next/server';
import { emitApiCallSucceeded } from '@/lib/server/analytics';

describe('server API success analytics', () => {
  const originalMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const originalApiSecret = process.env.GA4_MP_API_SECRET;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalMeasurementId;
    process.env.GA4_MP_API_SECRET = originalApiSecret;
    globalThis.fetch = originalFetch;
  });

  it('does not emit for requests without explicit consent', async () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST';
    process.env.GA4_MP_API_SECRET = 'secret';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await emitApiCallSucceeded(
      new NextRequest('https://agent-utils.test/app/v1/audit', {
        headers: { cookie: '_ga=GA1.1.123.456' },
      }),
      200,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits a coarse, consented event without dynamic path data', async () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST';
    process.env.GA4_MP_API_SECRET = 'secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock;

    await emitApiCallSucceeded(
      new NextRequest('https://agent-utils.test/app/v1/audit/customer-secret-id', {
        headers: {
          cookie: 'agent_utils_analytics_consent=accepted; _ga=GA1.1.123.456',
        },
      }),
      201,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload.client_id).toBe('123.456');
    expect(payload.events[0].name).toBe('api_call_succeeded');
    expect(payload.events[0].params).toMatchObject({
      api_resource: 'audit',
      http_method: 'GET',
      response_status: 201,
    });
    expect(JSON.stringify(payload)).not.toContain('customer-secret-id');
  });
});
