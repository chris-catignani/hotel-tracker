import { NextRequest, NextResponse } from "next/server";
import { withAxiomRouteHandler } from "next-axiom";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

export const POST = withAxiomRouteHandler(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { bookingId, partnershipEarnId, postingStatus } = await request.json();

    // IDOR check
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { id: true },
    });
    if (!booking) return apiError("Booking not found", null, 404, request, { bookingId });

    const record = await prisma.bookingPartnershipEarnStatus.create({
      data: { bookingId, partnershipEarnId, postingStatus },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return apiError("Failed to create partnership earn status", error, 500, request);
  }
});
