import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2 incremental cache: data-driven routes are dynamic and static assets
// are served from the worker's assets binding.
export default defineCloudflareConfig({});
