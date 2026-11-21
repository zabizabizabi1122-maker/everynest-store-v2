import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Level 12 end-to-end flow.
 *
 * By default Playwright starts the already-built app on 127.0.0.1:3000 using
 * the local `.env.local` configuration. Set E2E_BASE_URL to test a running
 * instance instead (CI does this against its own short-lived server).
 *
 * IMPORTANT: point E2E at a disposable test project, never at production.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const usesExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: "npm run start -- -p 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
