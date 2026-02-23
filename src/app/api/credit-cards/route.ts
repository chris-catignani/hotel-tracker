import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const creditCards = await prisma.creditCard.findMany({
      where: { isDeleted: false },
      include: { pointType: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(creditCards);
  } catch (error) {
    return apiError("Failed to fetch credit cards", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, rewardType, rewardRate, pointTypeId } = body;

    const creditCard = await prisma.creditCard.create({
      data: {
        name,
        rewardType,
        rewardRate: Number(rewardRate),
        pointTypeId: pointTypeId ? Number(pointTypeId) : null,
      },
      include: { pointType: true },
    });

    return NextResponse.json(creditCard, { status: 201 });
  } catch (error) {
    return apiError("Failed to create credit card", error);
  }
}
