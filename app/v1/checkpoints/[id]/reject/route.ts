/** POST /v1/checkpoints/[id]/reject (admin OR approval-proxy) */
import type { NextRequest } from 'next/server';
import { REJECT } from '@/app/v1/checkpoints/[[...id]]/route';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  return REJECT(req, { id: [params.id] });
}
