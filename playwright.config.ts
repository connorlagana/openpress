import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const runId = Date.now();

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${PORT}`,
      DATABASE_URL: `pglite://./.data/e2e-${runId}`,
      LOCAL_MEDIA_DIR: `.data/e2e-media-${runId}`,
      APP_SECRET: "e2e-secret",
      PASSWORD_ITERATIONS: "1000",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
