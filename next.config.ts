import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /signup was never built — redirect to v2 docs where API key creation is documented
      { source: "/signup", destination: "/docs/v2", permanent: true },
      // Redirect removed tools to their closest surviving equivalent
      { source: "/tools/notify", destination: "/tools/dlq", permanent: true },
      { source: "/tools/audit", destination: "/tools/checkpoint", permanent: true },
      { source: "/tools/file-host", destination: "/", permanent: true },
      { source: "/tools/form", destination: "/", permanent: true },
      { source: "/tools/kv", destination: "/", permanent: true },
      { source: "/tools/otp", destination: "/", permanent: true },
      { source: "/tools/rate-limit", destination: "/", permanent: true },
      { source: "/tools/shield", destination: "/tools/dlq", permanent: true },
      { source: "/tools/webhook", destination: "/tools/dlq", permanent: true },
      // Redirect removed docs to their closest surviving equivalent
      { source: "/docs/notify", destination: "/docs/dlq", permanent: true },
      { source: "/docs/audit", destination: "/docs/checkpoint", permanent: true },
      { source: "/docs/file-host", destination: "/docs", permanent: true },
      { source: "/docs/form", destination: "/docs", permanent: true },
      { source: "/docs/kv", destination: "/docs", permanent: true },
      { source: "/docs/otp", destination: "/docs", permanent: true },
      { source: "/docs/rate-limit", destination: "/docs", permanent: true },
      { source: "/docs/shield", destination: "/docs/dlq", permanent: true },
      { source: "/docs/webhook", destination: "/docs/dlq", permanent: true },
    ];
  },
};

export default nextConfig;
