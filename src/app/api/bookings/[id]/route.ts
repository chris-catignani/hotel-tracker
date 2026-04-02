import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { getBooking, updateBooking, patchBooking, deleteBooking } from "@/services/booking.service";

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const booking = await getBooking(id, userId);
      return NextResponse.json(booking);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request);
      return apiError("Failed to fetch booking", error, 500, request, { bookingId: id });
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
      const booking = await updateBooking(id, userId, body);
      return NextResponse.json(booking);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request);
      return apiError("Failed to update booking", error, 500, request, { bookingId: id });
    }
  }
);

export const PATCH = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const body = await request.json();
      const booking = await patchBooking(id, userId, body);
      return NextResponse.json(booking);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request);
      return apiError("Failed to update booking", error, 500, request, { bookingId: id });
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

      await deleteBooking(id, userId);
      return NextResponse.json({ message: "Booking deleted" });
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request);
      return apiError("Failed to delete booking", error, 500, request, { bookingId: id });
    }
  }
);
