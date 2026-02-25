import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PromotionType } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings } from "@/lib/promotion-matching";
import { PromotionBenefitFormData, PromotionTierFormData, PromotionFormData } from "@/lib/types";

const PROMOTION_INCLUDE = {
  hotelChain: true,
  hotelChainSubBrand: true,
  creditCard: true,
  tieInCards: { include: { creditCard: true } },
  shoppingPortal: true,
  benefits: { orderBy: { sortOrder: "asc" as const } },
  tiers: {
    orderBy: { minStays: "asc" as const },
    include: { benefits: { orderBy: { sortOrder: "asc" as const } } },
  },
  exclusions: true,
} as const;

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
      include: PROMOTION_INCLUDE,
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
      tiers,
      hotelChainId,
      hotelChainSubBrandId,
      creditCardId,
      shoppingPortalId,
      minSpend,
      startDate,
      endDate,
      isActive,
      isSingleUse,
      maxRedemptionCount,
      maxRedemptionValue,
      maxTotalBonusPoints,
      minNightsRequired,
      nightsStackable,
      bookByDate,
      oncePerSubBrand,
      exclusionSubBrandIds,
      tieInCreditCardIds,
      tieInRequiresPayment,
    } = body as PromotionFormData & { exclusionSubBrandIds?: number[] };

    const hasTiers = Array.isArray(tiers) && tiers.length > 0;

    const promotion = await prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
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
          isSingleUse: isSingleUse ?? false,
          maxRedemptionCount: maxRedemptionCount != null ? Number(maxRedemptionCount) : null,
          maxRedemptionValue: maxRedemptionValue != null ? Number(maxRedemptionValue) : null,
          maxTotalBonusPoints: maxTotalBonusPoints != null ? Number(maxTotalBonusPoints) : null,
          minNightsRequired: minNightsRequired != null ? Number(minNightsRequired) : null,
          nightsStackable: nightsStackable ?? false,
          bookByDate: bookByDate ? new Date(bookByDate) : null,
          oncePerSubBrand: oncePerSubBrand ?? false,
          tieInRequiresPayment: tieInRequiresPayment ?? false,
          ...(hasTiers
            ? {
                tiers: {
                  create: (tiers as PromotionTierFormData[]).map((tier) => ({
                    minStays: tier.minStays,
                    maxStays: tier.maxStays ?? null,
                    benefits: {
                      create: (tier.benefits || []).map(
                        (b: PromotionBenefitFormData, i: number) => ({
                          rewardType: b.rewardType,
                          valueType: b.valueType,
                          value: Number(b.value),
                          certType: b.certType || null,
                          pointsMultiplierBasis: b.pointsMultiplierBasis || null,
                          isTieIn: b.isTieIn ?? false,
                          sortOrder: b.sortOrder ?? i,
                        })
                      ),
                    },
                  })),
                },
              }
            : {
                benefits: {
                  create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) => ({
                    rewardType: b.rewardType,
                    valueType: b.valueType,
                    value: Number(b.value),
                    certType: b.certType || null,
                    pointsMultiplierBasis: b.pointsMultiplierBasis || null,
                    isTieIn: b.isTieIn ?? false,
                    sortOrder: b.sortOrder ?? i,
                  })),
                },
              }),
        },
        include: PROMOTION_INCLUDE,
      });

      if (Array.isArray(exclusionSubBrandIds) && exclusionSubBrandIds.length > 0) {
        await tx.promotionExclusion.createMany({
          data: exclusionSubBrandIds.map((subBrandId) => ({
            promotionId: created.id,
            hotelChainSubBrandId: subBrandId,
          })),
        });
      }

      if (Array.isArray(tieInCreditCardIds) && tieInCreditCardIds.length > 0) {
        await tx.promotionTieInCard.createMany({
          data: tieInCreditCardIds.map((cardId) => ({
            promotionId: created.id,
            creditCardId: Number(cardId),
          })),
        });
      }

      return created;
    });

    await matchPromotionsForAffectedBookings(promotion.id);

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return apiError("Failed to create promotion", error);
  }
}
