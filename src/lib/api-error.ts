import { NextRequest, NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Returns a JSON error response. In development (when DEBUG is enabled server-side),
 * includes the full error message and stack trace. In production, returns a generic message.
 * Logs the error to the server console with request context if provided.
 * Always reports to Sentry (no-op if SENTRY_DSN is not configured).
 */
export function apiError(
  message: string,
  error: unknown,
  status: number = 500,
  request?: NextRequest,
  context?: Record<string, unknown>
) {
  const isDev = process.env.NODE_ENV === "development";

  // Use unified logger
  logger.error(message, error, {
    path: request?.nextUrl.pathname,
    method: request?.method,
    ...context,
  });

  const body: Record<string, unknown> = { error: message };

  if (isDev && error instanceof Error) {
    body.debug = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  } else if (isDev && error) {
    body.debug = { raw: String(error) };
  }

  return NextResponse.json(body, { status });
}
