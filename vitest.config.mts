import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL: "pglite://memory", APP_SECRET: "test-secret", PASSWORD_ITERATIONS: "1000", NEXT_PUBLIC_ROOT_DOMAIN: "folio.test", INDEXNOW: "off" },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
