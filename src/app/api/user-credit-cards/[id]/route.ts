import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { reapplyBenefitsForUserCard } from "@/services/card-benefit-apply";

const INCLUDE = {
  creditCard: { include: { pointType: true, rewardRules: true } },
} as const;

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const card = await prisma.userCreditCard.findFirst({
        where: { id, userId },
        include: INCLUDE,
      });
      if (!card)
        return apiError("User credit card not found", null, 404, request, { userCreditCardId: id });
      return NextResponse.json(card);
    } catch (error) {
      return apiError("Failed to fetch user credit card", error, 500, request, {
        userCreditCardId: id,
      });
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

      const exists = await prisma.userCreditCard.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists)
        return apiError("User credit card not found", null, 404, request, { userCreditCardId: id });

      const { creditCardId, nickname, openedDate, closedDate } = await request.json();

      const data: Record<string, unknown> = {};
      if (creditCardId !== undefined) data.creditCardId = creditCardId;
      if (nickname !== undefined) data.nickname = nickname || null;
      if (openedDate !== undefined) data.openedDate = openedDate ? new Date(openedDate) : null;
      if (closedDate !== undefined) data.closedDate = closedDate ? new Date(closedDate) : null;

      const card = await prisma.userCreditCard.update({
        where: { id },
        data,
        include: INCLUDE,
      });
      // Re-evaluate benefits in case openedDate/closedDate changed
      await reapplyBenefitsForUserCard(id, userId);

      return NextResponse.json(card);
    } catch (error) {
      return apiError("Failed to update user credit card", error, 500, request, {
        userCreditCardId: id,
      });
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

      const exists = await prisma.userCreditCard.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists)
        return apiError("User credit card not found", null, 404, request, { userCreditCardId: id });

      // Check if any bookings reference this card instance
      const bookingCount = await prisma.booking.count({ where: { userCreditCardId: id } });
      if (bookingCount > 0) {
        return apiError(
          "Cannot delete: this card instance is referenced by existing bookings.",
          null,
          409,
          request,
          { userCreditCardId: id }
        );
      }

      await prisma.userCreditCard.delete({ where: { id } });
      return NextResponse.json({ message: "User credit card deleted" });
    } catch (error) {
      return apiError("Failed to delete user credit card", error, 500, request, {
        userCreditCardId: id,
      });
    }
  }
);
