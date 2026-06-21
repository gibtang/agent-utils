/** POST /v1/checkpoints/[id]/approve (admin OR approval-proxy) */
import type { NextRequest } from 'next/server';
import { APPROVE } from '@/app/v1/checkpoints/[[...id]]/route';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  return APPROVE(req, { id: [params.id] });
}
