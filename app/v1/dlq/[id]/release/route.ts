/** POST /v1/dlq/[id]/release */
import { createRoute } from '@/lib/v2/route';
import { POST_release } from '@/app/v1/dlq/[[...id]]/route';
export const POST = createRoute<{ id?: string[] }>({ agentKey: true }, POST_release);
