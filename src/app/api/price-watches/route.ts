import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { listPriceWatches, upsertPriceWatch } from "@/services/price-watch.service";

/** GET /api/price-watches — list all price watches for the current user */
export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const watches = await listPriceWatches(userId);
    return NextResponse.json(watches);
  } catch (error) {
    return apiError("Failed to fetch price watches", error, 500, request);
  }
});

/**
 * POST /api/price-watches
 * Creates or updates (upserts) a PriceWatch for (userId, propertyId).
 * If bookingId is provided, also upserts a PriceWatchBooking.
 */
export const POST = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const body = await request.json();
    const watch = await upsertPriceWatch(userId, body);
    return NextResponse.json(watch, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, request);
    return apiError("Failed to create price watch", error, 500, request);
  }
});
