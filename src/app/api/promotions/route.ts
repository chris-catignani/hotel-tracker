import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PromotionType } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings } from "@/lib/promotion-matching";
import {
  PromotionBenefitFormData,
  PromotionTierFormData,
  PromotionFormData,
  PromotionRestrictionsFormData,
} from "@/lib/types";

const PROMOTION_INCLUDE = {
  hotelChain: true,
  creditCard: true,
  shoppingPortal: true,
  restrictions: {
    include: { subBrandRestrictions: true, tieInCards: true },
  },
  benefits: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      restrictions: { include: { subBrandRestrictions: true, tieInCards: true } },
    },
  },
  tiers: {
    orderBy: { minStays: "asc" as const },
    include: {
      benefits: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          restrictions: { include: { subBrandRestrictions: true, tieInCards: true } },
        },
      },
    },
  },
  userPromotions: true,
} as const;

function buildRestrictionsCreateData(r: PromotionRestrictionsFormData) {
  return {
    minSpend: r.minSpend ? Number(r.minSpend) : null,
    minNightsRequired: r.minNightsRequired ? Number(r.minNightsRequired) : null,
    nightsStackable: r.nightsStackable ?? false,
    maxRedemptionCount: r.maxRedemptionCount ? Number(r.maxRedemptionCount) : null,
    maxRedemptionValue: r.maxRedemptionValue ? Number(r.maxRedemptionValue) : null,
    maxTotalBonusPoints: r.maxTotalBonusPoints ? Number(r.maxTotalBonusPoints) : null,
    oncePerSubBrand: r.oncePerSubBrand ?? false,
    bookByDate: r.bookByDate ? new Date(r.bookByDate) : null,
    registrationDeadline: r.registrationDeadline ? new Date(r.registrationDeadline) : null,
    validDaysAfterRegistration: r.validDaysAfterRegistration
      ? Number(r.validDaysAfterRegistration)
      : null,
    tieInRequiresPayment: r.tieInRequiresPayment ?? false,
    subBrandRestrictions: {
      create: [
        ...(r.subBrandIncludeIds ?? []).map((id) => ({
          hotelChainSubBrandId: id,
          mode: "include" as const,
        })),
        ...(r.subBrandExcludeIds ?? []).map((id) => ({
          hotelChainSubBrandId: id,
          mode: "exclude" as const,
        })),
      ],
    },
    tieInCards: {
      create: (r.tieInCreditCardIds ?? []).map((id) => ({ creditCardId: id })),
    },
  };
}

function buildBenefitCreateData(b: PromotionBenefitFormData, i: number) {
  const base = {
    rewardType: b.rewardType,
    valueType: b.valueType,
    value: Number(b.value),
    certType: b.certType || null,
    pointsMultiplierBasis: b.pointsMultiplierBasis || null,
    sortOrder: b.sortOrder ?? i,
  };
  if (b.restrictions) {
    return { ...base, restrictions: { create: buildRestrictionsCreateData(b.restrictions) } };
  }
  return base;
}

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
      creditCardId,
      shoppingPortalId,
      startDate,
      endDate,
      isActive,
      restrictions,
    } = body as PromotionFormData;

    // registrationDate is stored in UserPromotion, extracted from restrictions
    const registrationDate = (restrictions as PromotionRestrictionsFormData | null)
      ?.registrationDate;

    const hasTiers = Array.isArray(tiers) && tiers.length > 0;

    const promotion = await prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          name,
          type,
          hotelChainId: hotelChainId || null,
          creditCardId: creditCardId || null,
          shoppingPortalId: shoppingPortalId || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isActive: isActive !== undefined ? isActive : true,
          ...(restrictions
            ? { restrictions: { create: buildRestrictionsCreateData(restrictions) } }
            : {}),
          ...(hasTiers
            ? {
                tiers: {
                  create: (tiers as PromotionTierFormData[]).map((tier) => ({
                    minStays: tier.minStays,
                    maxStays: tier.maxStays ?? null,
                    benefits: {
                      create: (tier.benefits || []).map((b: PromotionBenefitFormData, i: number) =>
                        buildBenefitCreateData(b, i)
                      ),
                    },
                  })),
                },
              }
            : {
                benefits: {
                  create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) =>
                    buildBenefitCreateData(b, i)
                  ),
                },
              }),
        },
        include: PROMOTION_INCLUDE,
      });

      if (registrationDate) {
        await tx.userPromotion.create({
          data: {
            promotionId: created.id,
            registrationDate: new Date(registrationDate),
          },
        });
      }

      // Re-fetch to get all relations including the newly created ones
      return tx.promotion.findUnique({
        where: { id: created.id },
        include: PROMOTION_INCLUDE,
      }) as Promise<import("@prisma/client").Promotion>;
    });

    await matchPromotionsForAffectedBookings(promotion.id);

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return apiError("Failed to create promotion", error);
  }
}
