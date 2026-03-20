import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

const INCLUDE = {
  creditCard: { include: { pointType: true, rewardRules: true } },
} as const;

export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const cards = await prisma.userCreditCard.findMany({
      where: { userId },
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(cards);
  } catch (error) {
    return apiError("Failed to fetch user credit cards", error, 500, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { creditCardId, nickname, openedDate, closedDate } = await request.json();

    if (!creditCardId) {
      return apiError("creditCardId is required", null, 400, request);
    }

    const card = await prisma.userCreditCard.create({
      data: {
        userId,
        creditCardId,
        nickname: nickname || null,
        openedDate: openedDate ? new Date(openedDate) : null,
        closedDate: closedDate ? new Date(closedDate) : null,
      },
      include: INCLUDE,
    });
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return apiError("Failed to create user credit card", error, 500, request);
  }
}
