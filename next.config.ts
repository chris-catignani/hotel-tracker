import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print Sentry CLI output in CI
  silent: !process.env.CI,

  // Upload larger set of source map artifacts for accurate stack traces
  widenClientFileUpload: true,

  // Don't set up Vercel Cron Monitors (we use GitHub Actions)
  webpack: {
    automaticVercelMonitors: false,
  },
});
