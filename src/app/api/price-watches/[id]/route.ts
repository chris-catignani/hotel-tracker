import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { getPriceWatch, updatePriceWatch, deletePriceWatch } from "@/services/price-watch.service";

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const watch = await getPriceWatch(id, userId);
      return NextResponse.json(watch);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { priceWatchId: id });
      return apiError("Failed to fetch price watch", error, 500, request, { priceWatchId: id });
    }
  }
);

/** PUT /api/price-watches/[id] — toggle isEnabled */
export const PUT = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const { isEnabled } = await request.json();
      const watch = await updatePriceWatch(id, userId, { isEnabled });
      return NextResponse.json(watch);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { priceWatchId: id });
      return apiError("Failed to update price watch", error, 500, request, { priceWatchId: id });
    }
  }
);

/** DELETE /api/price-watches/[id] */
export const DELETE = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      await deletePriceWatch(id, userId);
      return NextResponse.json({ message: "Price watch deleted" });
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { priceWatchId: id });
      return apiError("Failed to delete price watch", error, 500, request, { priceWatchId: id });
    }
  }
);
