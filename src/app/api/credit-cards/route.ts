import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { CreditCardRewardRuleFormData } from "@/lib/types";

const CARD_INCLUDE = {
  pointType: true,
  rewardRules: {
    include: {
      hotelChain: true,
      otaAgency: true,
    },
  },
} as const;

export async function GET() {
  try {
    const cards = await prisma.creditCard.findMany({
      where: { isDeleted: false },
      include: CARD_INCLUDE,
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(cards);
  } catch (error) {
    return apiError("Failed to fetch credit cards", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, rewardType, rewardRate, pointTypeId, rewardRules } = await request.json();

    const card = await prisma.creditCard.create({
      data: {
        name,
        rewardType,
        rewardRate: Number(rewardRate),
        pointType: pointTypeId ? { connect: { id: pointTypeId } } : undefined,
        rewardRules: {
          create: (rewardRules || []).map((rule: CreditCardRewardRuleFormData) => ({
            hotelChainId: rule.hotelChainId,
            otaAgencyId: rule.otaAgencyId,
            rewardType: rule.rewardType,
            rewardValue: Number(rule.rewardValue),
          })),
        },
      },
      include: CARD_INCLUDE,
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return apiError("Failed to create credit card", error);
  }
}
