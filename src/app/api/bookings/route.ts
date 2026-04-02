import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { listBookings, createBooking } from "@/services/booking.service";

export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter");

    const bookings = await listBookings(userId, filter);
    return NextResponse.json(bookings);
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, request);
    return apiError("Failed to fetch bookings", error, 500, request);
  }
});

export const POST = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const body = await request.json();
    const booking = await createBooking(userId, body);
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, request);
    return apiError("Failed to create booking", error, 500, request);
  }
});
