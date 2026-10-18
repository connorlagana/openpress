import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every route is dynamic (multi-tenant, host-based), so no incremental cache is configured.
export default defineCloudflareConfig({});
