import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

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
  request?: NextRequest
) {
  const isDev = process.env.NODE_ENV === "development";

  // Log to server console
  const reqContext = request ? `[${request.method} ${request.nextUrl.pathname}] ` : "";
  console.error(`${reqContext}API ERROR: ${message}`, error);

  // Report to Sentry (no-op if DSN not configured)
  // void discards the string return value (event ID) so it doesn't affect type inference
  if (error) {
    void Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      extra: { message, path: request?.nextUrl.pathname },
    });
  }

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
