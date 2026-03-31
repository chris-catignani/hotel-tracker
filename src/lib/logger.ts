import * as SentryNext from "@sentry/nextjs";
import * as SentryNode from "@sentry/node";
import { log as axiomLog } from "next-axiom";

/**
 * Unified Logger to handle console logging, Sentry reporting, and Axiom structured logging
 * across all environments. Selects the appropriate Sentry SDK (Next.js vs. Node.js).
 */

const IS_SERVER = typeof window === "undefined";
const IS_NEXT = process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge";

// Standalone Node workers (e.g., price watch refresh) use @sentry/node.
// Next.js (server & client) uses @sentry/nextjs.
const Sentry = IS_NEXT || !IS_SERVER ? SentryNext : SentryNode;

// Mirror next-axiom's NEXT_PUBLIC_AXIOM_LOG_LEVEL so a single env var controls
// both Axiom forwarding and console output. Defaults to 'debug' (log everything).
// Set to 'warn' in CI (playwright.config.ts webServer env) to suppress INFO noise.
const LOG_LEVEL = process.env.NEXT_PUBLIC_AXIOM_LOG_LEVEL ?? "debug";
const LOG_INFO = LOG_LEVEL === "debug" || LOG_LEVEL === "info";

function formatMessage(message: string, extra?: Record<string, unknown>): string {
  if (extra && Object.keys(extra).length > 0) {
    return `${message} ${JSON.stringify(extra)}`;
  }
  return message;
}

export const logger = {
  info(message: string, extra?: Record<string, unknown>) {
    if (LOG_INFO) console.log(`[INFO] ${formatMessage(message, extra)}`);
    // Only forward to Axiom when the token is actually configured; otherwise
    // next-axiom falls back to a duplicate console.log with a 1-second delay.
    if (process.env.AXIOM_TOKEN) axiomLog.info(message, extra);
  },

  warn(message: string, extra?: Record<string, unknown>) {
    const formatted = formatMessage(message, extra);
    console.warn(`[WARN] ${formatted}`);
    Sentry.captureMessage(message, {
      level: "warning",
      extra,
    });
    if (process.env.AXIOM_TOKEN) axiomLog.warn(message, extra);
  },

  error(message: string, error?: unknown, extra?: Record<string, unknown>) {
    const formatted = formatMessage(message, extra);
    console.error(`[ERROR] ${formatted}`, error);

    const errObj = error instanceof Error ? error : new Error(String(error || message));
    Sentry.captureException(errObj, {
      extra: {
        ...extra,
        originalMessage: message,
      },
    });
    if (process.env.AXIOM_TOKEN)
      axiomLog.error(message, {
        ...extra,
        errorMessage:
          error instanceof Error ? error.message : error != null ? String(error) : undefined,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
  },
};
