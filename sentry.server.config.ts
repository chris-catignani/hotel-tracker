import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV !== "development",
  tracesSampleRate: 0.1,
  debug: false,
});
