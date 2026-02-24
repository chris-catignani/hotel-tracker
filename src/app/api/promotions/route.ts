import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PromotionType } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings } from "@/lib/promotion-matching";
import { PromotionBenefitFormData } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type as PromotionType;
    }

    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        hotelChain: true,
        hotelChainSubBrand: true,
        creditCard: true,
        shoppingPortal: true,
        benefits: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(promotions);
  } catch (error) {
    return apiError("Failed to fetch promotions", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      benefits,
      hotelChainId,
      hotelChainSubBrandId,
      creditCardId,
      shoppingPortalId,
      minSpend,
      startDate,
      endDate,
      isActive,
    } = body;

    const promotion = await prisma.promotion.create({
      data: {
        name,
        type,
        hotelChainId: hotelChainId ? Number(hotelChainId) : null,
        hotelChainSubBrandId: hotelChainSubBrandId ? Number(hotelChainSubBrandId) : null,
        creditCardId: creditCardId ? Number(creditCardId) : null,
        shoppingPortalId: shoppingPortalId ? Number(shoppingPortalId) : null,
        minSpend: minSpend != null ? Number(minSpend) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true,
        benefits: {
          create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) => ({
            rewardType: b.rewardType,
            valueType: b.valueType,
            value: Number(b.value),
            certType: b.certType || null,
            sortOrder: b.sortOrder ?? i,
          })),
        },
      },
      include: {
        benefits: { orderBy: { sortOrder: "asc" } },
      },
    });

    await matchPromotionsForAffectedBookings(promotion.id);

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return apiError("Failed to create promotion", error);
  }
}
