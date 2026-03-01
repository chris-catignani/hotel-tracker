import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PromotionType, Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings, reevaluateBookings } from "@/lib/promotion-matching";
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const promotion = await prisma.promotion.findUnique({
      where: { id: id },
      include: PROMOTION_INCLUDE,
    });

    if (!promotion) {
      return apiError("Promotion not found", null, 404, request);
    }

    return NextResponse.json(promotion);
  } catch (error) {
    return apiError("Failed to fetch promotion", error, 500, request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const registrationDate = (restrictions as PromotionRestrictionsFormData | null | undefined)
      ?.registrationDate;

    const data: Prisma.PromotionUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type as PromotionType;

    if (hotelChainId !== undefined) {
      data.hotelChain = hotelChainId ? { connect: { id: hotelChainId } } : { disconnect: true };
    }
    if (creditCardId !== undefined) {
      data.creditCard = creditCardId ? { connect: { id: creditCardId } } : { disconnect: true };
    }
    if (shoppingPortalId !== undefined) {
      data.shoppingPortal = shoppingPortalId
        ? { connect: { id: shoppingPortalId } }
        : { disconnect: true };
    }

    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;

    const hasTiers = benefits === undefined ? tiers !== undefined : false;
    const replacingBenefitsOrTiers = benefits !== undefined || tiers !== undefined;

    const promotion = await prisma.$transaction(async (tx) => {
      // Handle restrictions upsert
      if (restrictions !== undefined) {
        // Fetch existing promotion to get restrictionsId
        const existingPromo = await tx.promotion.findUnique({
          where: { id },
          select: { restrictionsId: true },
        });

        if (restrictions === null) {
          // Clear restrictions: delete the existing record if present
          if (existingPromo?.restrictionsId) {
            // The cascade will clean up subBrandRestrictions and tieInCards
            await tx.promotionRestrictions.delete({
              where: { id: existingPromo.restrictionsId },
            });
            data.restrictions = { disconnect: true };
          }
        } else {
          // Upsert restrictions
          if (existingPromo?.restrictionsId) {
            // Delete children and recreate
            await tx.promotionSubBrandRestriction.deleteMany({
              where: { promotionRestrictionsId: existingPromo.restrictionsId },
            });
            await tx.promotionRestrictionTieInCard.deleteMany({
              where: { promotionRestrictionsId: existingPromo.restrictionsId },
            });
            // Update scalar fields and recreate children
            await tx.promotionRestrictions.update({
              where: { id: existingPromo.restrictionsId },
              data: {
                minSpend: restrictions.minSpend ? Number(restrictions.minSpend) : null,
                minNightsRequired: restrictions.minNightsRequired
                  ? Number(restrictions.minNightsRequired)
                  : null,
                nightsStackable: restrictions.nightsStackable ?? false,
                spanStays: restrictions.spanStays ?? false,
                maxStayCount: restrictions.maxStayCount ? Number(restrictions.maxStayCount) : null,
                maxRewardCount: restrictions.maxRewardCount
                  ? Number(restrictions.maxRewardCount)
                  : null,
                maxRedemptionValue: restrictions.maxRedemptionValue
                  ? Number(restrictions.maxRedemptionValue)
                  : null,
                maxTotalBonusPoints: restrictions.maxTotalBonusPoints
                  ? Number(restrictions.maxTotalBonusPoints)
                  : null,
                oncePerSubBrand: restrictions.oncePerSubBrand ?? false,
                bookByDate: restrictions.bookByDate ? new Date(restrictions.bookByDate) : null,
                registrationDeadline: restrictions.registrationDeadline
                  ? new Date(restrictions.registrationDeadline)
                  : null,
                validDaysAfterRegistration: restrictions.validDaysAfterRegistration
                  ? Number(restrictions.validDaysAfterRegistration)
                  : null,
                tieInRequiresPayment: restrictions.tieInRequiresPayment ?? false,
                allowedPaymentTypes: restrictions.allowedPaymentTypes ?? [],
                allowedBookingSources: restrictions.allowedBookingSources ?? [],
                hotelChainId: restrictions.hotelChainId || null,
                subBrandRestrictions: {
                  create: [
                    ...(restrictions.subBrandIncludeIds ?? []).map((sbId) => ({
                      hotelChainSubBrandId: sbId,
                      mode: "include" as const,
                    })),
                    ...(restrictions.subBrandExcludeIds ?? []).map((sbId) => ({
                      hotelChainSubBrandId: sbId,
                      mode: "exclude" as const,
                    })),
                  ],
                },
                tieInCards: {
                  create: (restrictions.tieInCreditCardIds ?? []).map((cardId) => ({
                    creditCardId: cardId,
                  })),
                },
              },
            });
            // Ensure the relation is connected (though it should already be)
            data.restrictions = { connect: { id: existingPromo.restrictionsId } };
          } else {
            // Create new restrictions and link
            const newRestrictions = await tx.promotionRestrictions.create({
              data: buildRestrictionsCreateData(restrictions),
            });
            data.restrictions = { connect: { id: newRestrictions.id } };
          }
        }
      }

      if (replacingBenefitsOrTiers) {
        // Delete flat benefits (those directly on the promotion) along with their restrictions
        const benefitsToDelete = await tx.promotionBenefit.findMany({
          where: { promotionId: id },
          select: { id: true, restrictionsId: true },
        });
        for (const b of benefitsToDelete) {
          if (b.restrictionsId) {
            await tx.promotionRestrictions.delete({ where: { id: b.restrictionsId } });
          }
        }
        await tx.promotionBenefit.deleteMany({ where: { promotionId: id } });

        // Delete all tiers (cascade will remove tier benefits)
        // But we need to handle benefit restrictions first
        const tiersToDelete = await tx.promotionTier.findMany({
          where: { promotionId: id },
          include: { benefits: { select: { id: true, restrictionsId: true } } },
        });
        for (const tier of tiersToDelete) {
          for (const b of tier.benefits) {
            if (b.restrictionsId) {
              await tx.promotionRestrictions.delete({ where: { id: b.restrictionsId } });
            }
          }
        }
        await tx.promotionTier.deleteMany({ where: { promotionId: id } });
      }

      if (tiers !== undefined && Array.isArray(tiers) && tiers.length > 0) {
        data.tiers = {
          create: (tiers as PromotionTierFormData[]).map((tier) => ({
            minStays: tier.minStays,
            maxStays: tier.maxStays ?? null,
            benefits: {
              create: (tier.benefits || []).map((b: PromotionBenefitFormData, i: number) =>
                buildBenefitCreateData(b, i)
              ),
            },
          })),
        };
      } else if (benefits !== undefined && !hasTiers) {
        data.benefits = {
          create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) =>
            buildBenefitCreateData(b, i)
          ),
        };
      }

      // Handle UserPromotion
      if (registrationDate !== undefined) {
        if (registrationDate) {
          await tx.userPromotion.upsert({
            where: { promotionId: id },
            update: { registrationDate: new Date(registrationDate) },
            create: { promotionId: id, registrationDate: new Date(registrationDate) },
          });
        } else {
          await tx.userPromotion.deleteMany({ where: { promotionId: id } });
        }
      }

      return tx.promotion.update({
        where: { id: id },
        data,
        include: PROMOTION_INCLUDE,
      });
    });

    await matchPromotionsForAffectedBookings(promotion.id);

    return NextResponse.json(promotion);
  } catch (error) {
    return apiError("Failed to update promotion", error, 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find bookings that currently have this promotion applied
    const affectedBookings = await prisma.booking.findMany({
      where: { bookingPromotions: { some: { promotionId: id } } },
      select: { id: true },
    });

    // Collect all restriction IDs to delete (promotion-level + all benefit-level)
    const promo = await prisma.promotion.findUnique({
      where: { id },
      select: {
        restrictionsId: true,
        benefits: { select: { restrictionsId: true } },
        tiers: { include: { benefits: { select: { restrictionsId: true } } } },
      },
    });

    const restrictionIdsToDelete = [
      promo?.restrictionsId,
      ...(promo?.benefits ?? []).map((b) => b.restrictionsId),
      ...(promo?.tiers ?? []).flatMap((t) => t.benefits.map((b) => b.restrictionsId)),
    ].filter((rid): rid is string => rid !== null && rid !== undefined);

    await prisma.promotion.delete({ where: { id: id } });

    if (restrictionIdsToDelete.length > 0) {
      await prisma.promotionRestrictions.deleteMany({
        where: { id: { in: restrictionIdsToDelete } },
      });
    }

    if (affectedBookings.length > 0) {
      await reevaluateBookings(affectedBookings.map((b) => b.id));
    }

    return NextResponse.json({ message: "Promotion deleted" });
  } catch (error) {
    return apiError("Failed to delete promotion", error, 500, request);
  }
}
