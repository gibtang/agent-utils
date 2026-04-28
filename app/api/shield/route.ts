import { successResponse } from '@/lib/response';

// GET /api/shield — Info about the shield endpoints
export async function GET() {
  return successResponse({
    endpoints: {
      clean: {
        method: 'POST',
        path: '/api/shield/clean',
        description: 'Detect and redact PII from text',
        body: { text: 'string', ttlHours: 'number (optional, default 1)' },
        returns: { sessionId: 'string', cleaned: 'string', detectionsFound: 'number' },
      },
      hydrate: {
        method: 'POST',
        path: '/api/shield/hydrate',
        description: 'Restore original PII values using session ID',
        body: { sessionId: 'string', text: 'string' },
        returns: { hydrated: 'string', replacementsMade: 'number' },
      },
    },
    supportedTypes: ['email', 'phone', 'ssn', 'credit_card', 'ip_address', 'date'],
  });
}
