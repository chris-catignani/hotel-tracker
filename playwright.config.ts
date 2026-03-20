import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load environment variables from .env file if it exists
dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on failures (1 retry both locally and on CI). */
  retries: 1,
  /* Limit workers to 2 to reduce parallel DB contention. Same for local and CI. */
  workers: 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["list"], ["html", { open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://127.0.0.1:3001",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    video: process.env.CI ? "on-first-retry" : "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },

    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },

    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],

  /* Run a dedicated test server on port 3001 (separate from the dev server on 3000). */
  webServer: {
    command: "next dev -p 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST || "",
      NEXT_PUBLIC_DEBUG: "false",
      AUTH_SECRET: process.env.AUTH_SECRET || "",
      SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || "",
      SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || "",
      CRON_SECRET: process.env.CRON_SECRET || "test-cron-secret",
      // Disable Sentry in the E2E test server so test errors don't pollute
      // the production Sentry project.
      SENTRY_DSN: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
    },
  },
});
