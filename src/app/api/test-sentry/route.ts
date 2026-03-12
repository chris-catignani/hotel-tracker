/**
 * TEMPORARY — delete after verifying Sentry integration.
 * GET /api/test-sentry  →  triggers a captured error and returns 500.
 */
import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  return apiError(
    "Sentry integration test",
    new Error("Test error from /api/test-sentry"),
    500,
    request
  );
}
