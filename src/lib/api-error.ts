import { NextResponse } from "next/server";

/**
 * Returns a JSON error response. In development (when DEBUG is enabled server-side),
 * includes the full error message and stack trace. In production, returns a generic message.
 */
export function apiError(
  message: string,
  error: unknown,
  status: number = 500
) {
  const isDev = process.env.NODE_ENV === "development";

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
