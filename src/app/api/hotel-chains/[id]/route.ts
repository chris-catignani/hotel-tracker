import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/auth-utils";
import { getHotelChain, updateHotelChain, deleteHotelChain } from "@/services/hotel-chain.service";

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const hotelChain = await getHotelChain(id, userId);
      return NextResponse.json(hotelChain);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { hotelChainId: id });
      return apiError("Failed to fetch hotel chain", error, 500, request, { hotelChainId: id });
    }
  }
);

export const PUT = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const adminError = await requireAdmin();
      if (adminError instanceof NextResponse) return adminError;

      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const body = await request.json();
      const hotelChain = await updateHotelChain(id, userId, body);
      return NextResponse.json(hotelChain);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { hotelChainId: id });
      return apiError("Failed to update hotel chain", error, 500, request, { hotelChainId: id });
    }
  }
);

export const DELETE = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const adminError = await requireAdmin();
      if (adminError instanceof NextResponse) return adminError;

      await deleteHotelChain(id);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { hotelChainId: id });
      return apiError("Failed to delete hotel chain", error, 500, request, { hotelChainId: id });
    }
  }
);
