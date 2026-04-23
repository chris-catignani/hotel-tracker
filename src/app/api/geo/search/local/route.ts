import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { searchLocalProperties } from "@/services/geo-lookup";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const q = request.nextUrl.searchParams.get("q") ?? "";
    if (q.trim().length < 3) {
      return NextResponse.json([]);
    }

    const hotelChainId = request.nextUrl.searchParams.get("hotelChainId") ?? undefined;
    const start = Date.now();
    const results = await searchLocalProperties(q, hotelChainId);
    logger.info("geo:local_searched", {
      userId,
      query: q,
      hotelChainId: hotelChainId ?? null,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return NextResponse.json(results);
  } catch (error) {
    return apiError("Failed to search local properties", error, 500, request);
  }
});
