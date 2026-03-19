import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

const INCLUDE = {
  creditCard: { include: { pointType: true, rewardRules: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const card = await prisma.userCreditCard.findFirst({
      where: { id, userId },
      include: INCLUDE,
    });
    if (!card) return apiError("User credit card not found", null, 404, request);
    return NextResponse.json(card);
  } catch (error) {
    return apiError("Failed to fetch user credit card", error, 500, request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const exists = await prisma.userCreditCard.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!exists) return apiError("User credit card not found", null, 404, request);

    const { creditCardId, nickname, openedDate, closedDate, isActive } = await request.json();

    const data: Record<string, unknown> = {};
    if (creditCardId !== undefined) data.creditCardId = creditCardId;
    if (nickname !== undefined) data.nickname = nickname || null;
    if (openedDate !== undefined) data.openedDate = openedDate ? new Date(openedDate) : null;
    if (closedDate !== undefined) data.closedDate = closedDate ? new Date(closedDate) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const card = await prisma.userCreditCard.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    return NextResponse.json(card);
  } catch (error) {
    return apiError("Failed to update user credit card", error, 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const exists = await prisma.userCreditCard.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!exists) return apiError("User credit card not found", null, 404, request);

    // Check if any bookings reference this card instance
    const bookingCount = await prisma.booking.count({ where: { userCreditCardId: id } });
    if (bookingCount > 0) {
      return apiError(
        "Cannot delete: this card instance is referenced by existing bookings.",
        null,
        409,
        request
      );
    }

    await prisma.userCreditCard.delete({ where: { id } });
    return NextResponse.json({ message: "User credit card deleted" });
  } catch (error) {
    return apiError("Failed to delete user credit card", error, 500, request);
  }
}
