import { defineConfig, devices } from "@playwright/test";

// Smoke test against a deployed instance: LIVE_URL=https://openpress.blog pnpm test:live
// Creates a real account and site, then deletes the site at the end.
export default defineConfig({
  testDir: "tests/live",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.LIVE_URL ?? "https://openpress.blog", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
