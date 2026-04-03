import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { searchProperties } from "@/services/geo-lookup";
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

    const accommodationType = request.nextUrl.searchParams.get("accommodationType");
    const isHotel = accommodationType === "hotel";
    const start = Date.now();
    const results = await searchProperties(q, isHotel);
    logger.info("geo:searched", {
      userId,
      accommodationType: accommodationType ?? null,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return NextResponse.json(results);
  } catch (error) {
    return apiError("Failed to search properties", error, 500, request);
  }
});
