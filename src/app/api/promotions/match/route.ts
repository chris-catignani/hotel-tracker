import { NextRequest, NextResponse } from "next/server";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import { apiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId is required" },
        { status: 400 }
      );
    }

    const results = await matchPromotionsForBooking(Number(bookingId));
    return NextResponse.json(results);
  } catch (error) {
    return apiError("Failed to match promotions", error);
  }
}
