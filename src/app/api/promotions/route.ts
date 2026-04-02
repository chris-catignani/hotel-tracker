import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { AppError } from "@/lib/app-error";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { listPromotions, createPromotion } from "@/services/promotion.service";

export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const promotions = await listPromotions(userId, type);
    return NextResponse.json(promotions);
  } catch (error) {
    return apiError("Failed to fetch promotions", error, 500, request);
  }
});

export const POST = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;
    const body = await request.json();
    const promotion = await createPromotion(userId, body);
    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, request);
    return apiError("Failed to create promotion", error, 500, request);
  }
});
