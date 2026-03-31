import { NextRequest, NextResponse } from "next/server";
import { withObservability as withAxiom } from "@/lib/observability";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { searchProperties } from "@/lib/geo-lookup";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const GET = withAxiom(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const q = request.nextUrl.searchParams.get("q") ?? "";
    if (q.trim().length < 3) {
      return NextResponse.json([]);
    }

    const accommodationType = request.nextUrl.searchParams.get("accommodationType");
    const isHotel = accommodationType !== "apartment";
    const start = Date.now();
    const results = await searchProperties(q, isHotel);
    logger.info("geo:searched", {
      userId,
      accommodationType: accommodationType ?? "hotel",
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return NextResponse.json(results);
  } catch (error) {
    return apiError("Failed to search properties", error, 500, request);
  }
});
