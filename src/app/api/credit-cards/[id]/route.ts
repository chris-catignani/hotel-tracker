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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, rewardType, rewardRate, pointTypeId, rewardRules } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (rewardType !== undefined) data.rewardType = rewardType;
    if (rewardRate !== undefined) data.rewardRate = Number(rewardRate);
    if (pointTypeId !== undefined) {
      if (pointTypeId) {
        data.pointType = { connect: { id: pointTypeId } };
      } else {
        data.pointType = { disconnect: true };
      }
    }

    const creditCard = await prisma.$transaction(async (tx) => {
      // If rewardRules provided, replace them all
      if (rewardRules !== undefined) {
        await tx.creditCardRewardRule.deleteMany({
          where: { creditCardId: id },
        });

        if (Array.isArray(rewardRules) && rewardRules.length > 0) {
          await tx.creditCardRewardRule.createMany({
            data: rewardRules.map((rule: CreditCardRewardRuleFormData) => ({
              creditCardId: id,
              hotelChainId: rule.hotelChainId,
              otaAgencyId: rule.otaAgencyId,
              rewardType: rule.rewardType,
              rewardValue: Number(rule.rewardValue),
            })),
          });
        }
      }

      return tx.creditCard.update({
        where: { id: id },
        data,
        include: CARD_INCLUDE,
      });
    });

    return NextResponse.json(creditCard);
  } catch (error) {
    return apiError("Failed to update credit card", error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.creditCard.update({
      where: { id: id },
      data: { isDeleted: true },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete credit card", error);
  }
}
