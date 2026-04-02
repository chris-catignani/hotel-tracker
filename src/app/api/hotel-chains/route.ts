import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/auth-utils";
import { listHotelChains, createHotelChain } from "@/services/hotel-chain.service";

export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const hotelChains = await listHotelChains(userId);
    return NextResponse.json(hotelChains);
  } catch (error) {
    return apiError("Failed to fetch hotel chains", error, 500, request);
  }
});

export const POST = withObservability(async (request: NextRequest) => {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const body = await request.json();
    const hotelChain = await createHotelChain(body);
    return NextResponse.json(hotelChain, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, request);
    return apiError("Failed to create hotel chain", error, 500, request);
  }
});
