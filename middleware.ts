import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

export default withAuth(
  async function middleware() {
    // Kinde handles auth checking automatically
  },
  {
    publicPaths: ["/", "/pricing", "/api/webhooks", "/api/auth", "/api/health", "/docs", "/llms.txt"],
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
  ],
};
