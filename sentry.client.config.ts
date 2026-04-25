import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV !== "development",

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // No session replays needed for a personal app
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  debug: false,
});
