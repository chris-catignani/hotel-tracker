import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PromotionType, Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings } from "@/lib/promotion-matching";
import {
  PromotionBenefitFormData,
  PromotionTierFormData,
  PromotionFormData,
  PromotionRestrictionsFormData,
} from "@/lib/types";
import { buildRestrictionsCreateData, buildBenefitCreateData } from "@/lib/promotion-api-helpers";

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
    return apiError("Failed to fetch promotions", error, 500, request);
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
          hotelChain: hotelChainId ? { connect: { id: hotelChainId } } : undefined,
          creditCard: creditCardId ? { connect: { id: creditCardId } } : undefined,
          shoppingPortal: shoppingPortalId ? { connect: { id: shoppingPortalId } } : undefined,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
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
        } as unknown as Prisma.PromotionCreateInput,
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
    return apiError("Failed to create promotion", error, 500, request);
  }
}
