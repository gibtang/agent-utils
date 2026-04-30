import { handleAuth } from "@kinde-oss/kinde-auth-nextjs/server";

export const dynamic = 'force-dynamic';

export function GET(...args: Parameters<ReturnType<typeof handleAuth>>) {
  return handleAuth()(...args);
}
