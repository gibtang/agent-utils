import { successResponse } from '@/lib/response';

// This tool has been removed from AgentUtils.
export async function GET() {
  return successResponse({ error: 'This endpoint has been discontinued.' }, 410);
}
