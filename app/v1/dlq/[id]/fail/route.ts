/** POST /v1/dlq/[id]/fail */
import { createRoute } from '@/lib/v2/route';
import { POST_fail } from '@/app/v1/dlq/[[...id]]/route';
export const POST = createRoute<{ id?: string[] }>({ agentKey: true }, POST_fail);
