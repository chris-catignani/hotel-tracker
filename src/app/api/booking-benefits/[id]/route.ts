import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

export const PATCH = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      // Note: this endpoint only supports updating postingStatus
      const { postingStatus } = await request.json();

      const exists = await prisma.bookingBenefit.findFirst({
        where: { id, booking: { userId } },
        select: { id: true },
      });
      if (!exists) return apiError("Booking benefit not found", null, 404, request, { id });

      const updated = await prisma.bookingBenefit.update({
        where: { id },
        data: { postingStatus },
      });

      return NextResponse.json(updated);
    } catch (error) {
      return apiError("Failed to update booking benefit", error, 500, request, { id });
    }
  }
);
