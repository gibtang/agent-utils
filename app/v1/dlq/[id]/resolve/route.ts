/** POST /v1/dlq/[id]/resolve */
import { createRoute } from '@/lib/v2/route';
import { POST_resolve } from '@/app/v1/dlq/[[...id]]/route';
export const POST = createRoute<{ id?: string[] }>({ agentKey: true }, POST_resolve);
