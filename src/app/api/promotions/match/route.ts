import { NextRequest, NextResponse } from "next/server";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";

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
    const message =
      error instanceof Error ? error.message : "Failed to match promotions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
