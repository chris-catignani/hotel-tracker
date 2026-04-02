import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { AppError } from "@/lib/app-error";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { getPromotion, updatePromotion, deletePromotion } from "@/services/promotion.service";

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;
      const promotion = await getPromotion(id, userId);
      return NextResponse.json(promotion);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { promotionId: id });
      return apiError("Failed to fetch promotion", error, 500, request, { promotionId: id });
    }
  }
);

export const PUT = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;
      const body = await request.json();
      const promotion = await updatePromotion(id, userId, body);
      return NextResponse.json(promotion);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { promotionId: id });
      return apiError("Failed to update promotion", error, 500, request, { promotionId: id });
    }
  }
);

export const DELETE = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;
      await deletePromotion(id, userId);
      return NextResponse.json({ message: "Promotion deleted" });
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { promotionId: id });
      return apiError("Failed to delete promotion", error, 500, request, { promotionId: id });
    }
  }
);
