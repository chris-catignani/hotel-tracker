import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings, reevaluateBookings } from "@/lib/promotion-matching";
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
  userPromotions: true,
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const promotion = await prisma.promotion.findUnique({
      where: { id: Number(id) },
      include: PROMOTION_INCLUDE,
    });

    if (!promotion) {
      return apiError("Promotion not found", null, 404);
    }

    return NextResponse.json(promotion);
  } catch (error) {
    return apiError("Failed to fetch promotion", error);
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
      registrationDeadline,
      validDaysAfterRegistration,
      registrationDate,
    } = body as PromotionFormData & { exclusionSubBrandIds?: number[] };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (hotelChainId !== undefined) data.hotelChainId = hotelChainId ? Number(hotelChainId) : null;
    if (hotelChainSubBrandId !== undefined)
      data.hotelChainSubBrandId = hotelChainSubBrandId ? Number(hotelChainSubBrandId) : null;
    if (creditCardId !== undefined) data.creditCardId = creditCardId ? Number(creditCardId) : null;
    if (shoppingPortalId !== undefined)
      data.shoppingPortalId = shoppingPortalId ? Number(shoppingPortalId) : null;
    if (minSpend !== undefined) data.minSpend = minSpend != null ? Number(minSpend) : null;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) data.isActive = isActive;
    if (isSingleUse !== undefined) data.isSingleUse = isSingleUse;
    if (maxRedemptionCount !== undefined)
      data.maxRedemptionCount = maxRedemptionCount != null ? Number(maxRedemptionCount) : null;
    if (maxRedemptionValue !== undefined)
      data.maxRedemptionValue = maxRedemptionValue != null ? Number(maxRedemptionValue) : null;
    if (maxTotalBonusPoints !== undefined)
      data.maxTotalBonusPoints = maxTotalBonusPoints != null ? Number(maxTotalBonusPoints) : null;
    if (minNightsRequired !== undefined)
      data.minNightsRequired = minNightsRequired != null ? Number(minNightsRequired) : null;
    if (nightsStackable !== undefined) data.nightsStackable = nightsStackable;
    if (bookByDate !== undefined) data.bookByDate = bookByDate ? new Date(bookByDate) : null;
    if (oncePerSubBrand !== undefined) data.oncePerSubBrand = oncePerSubBrand;
    if (tieInRequiresPayment !== undefined) data.tieInRequiresPayment = tieInRequiresPayment;
    if (registrationDeadline !== undefined)
      data.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null;
    if (validDaysAfterRegistration !== undefined)
      data.validDaysAfterRegistration =
        validDaysAfterRegistration != null ? Number(validDaysAfterRegistration) : null;

    const hasTiers = benefits === undefined ? tiers !== undefined : false;
    const replacingBenefitsOrTiers = benefits !== undefined || tiers !== undefined;

    const promotion = await prisma.$transaction(async (tx) => {
      if (replacingBenefitsOrTiers) {
        // Delete flat benefits (those directly on the promotion)
        await tx.promotionBenefit.deleteMany({ where: { promotionId: Number(id) } });
        // Delete all tiers (cascade will remove tier benefits)
        await tx.promotionTier.deleteMany({ where: { promotionId: Number(id) } });
      }

      if (tiers !== undefined && Array.isArray(tiers) && tiers.length > 0) {
        data.tiers = {
          create: (tiers as PromotionTierFormData[]).map((tier) => ({
            minStays: tier.minStays,
            maxStays: tier.maxStays ?? null,
            benefits: {
              create: (tier.benefits || []).map((b: PromotionBenefitFormData, i: number) => ({
                rewardType: b.rewardType,
                valueType: b.valueType,
                value: Number(b.value),
                certType: b.certType || null,
                pointsMultiplierBasis: b.pointsMultiplierBasis || null,
                isTieIn: b.isTieIn ?? false,
                sortOrder: b.sortOrder ?? i,
              })),
            },
          })),
        };
      } else if (benefits !== undefined && !hasTiers) {
        data.benefits = {
          create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) => ({
            rewardType: b.rewardType,
            valueType: b.valueType,
            value: Number(b.value),
            certType: b.certType || null,
            pointsMultiplierBasis: b.pointsMultiplierBasis || null,
            isTieIn: b.isTieIn ?? false,
            sortOrder: b.sortOrder ?? i,
          })),
        };
      }

      // Replace exclusions if provided
      if (exclusionSubBrandIds !== undefined) {
        await tx.promotionExclusion.deleteMany({ where: { promotionId: Number(id) } });
        if (exclusionSubBrandIds.length > 0) {
          await tx.promotionExclusion.createMany({
            data: exclusionSubBrandIds.map((subBrandId) => ({
              promotionId: Number(id),
              hotelChainSubBrandId: subBrandId,
            })),
          });
        }
      }

      // Replace tie-in cards if provided
      if (tieInCreditCardIds !== undefined) {
        await tx.promotionTieInCard.deleteMany({ where: { promotionId: Number(id) } });
        if (tieInCreditCardIds.length > 0) {
          await tx.promotionTieInCard.createMany({
            data: tieInCreditCardIds.map((cardId) => ({
              promotionId: Number(id),
              creditCardId: Number(cardId),
            })),
          });
        }
      }

      // Handle UserPromotion
      if (registrationDate !== undefined) {
        if (registrationDate) {
          await tx.userPromotion.upsert({
            where: { promotionId: Number(id) },
            update: { registrationDate: new Date(registrationDate) },
            create: { promotionId: Number(id), registrationDate: new Date(registrationDate) },
          });
        } else {
          await tx.userPromotion.deleteMany({ where: { promotionId: Number(id) } });
        }
      }

      return tx.promotion.update({
        where: { id: Number(id) },
        data,
        include: PROMOTION_INCLUDE,
      });
    });

    await matchPromotionsForAffectedBookings(promotion.id);

    return NextResponse.json(promotion);
  } catch (error) {
    return apiError("Failed to update promotion", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promotionId = Number(id);

    // Find bookings that currently have this promotion applied
    const affectedBookings = await prisma.booking.findMany({
      where: { bookingPromotions: { some: { promotionId } } },
      select: { id: true },
    });

    await prisma.promotion.delete({ where: { id: promotionId } });

    // Re-evaluate affected bookings after deletion.
    // Note: While Prisma cascade deletes will remove BookingPromotion records,
    // we manually re-evaluate to ensure the bookings are correctly updated
    // (e.g., if other promotions now apply or if summary totals need refresh).
    if (affectedBookings.length > 0) {
      await reevaluateBookings(affectedBookings.map((b) => b.id));
    }

    return NextResponse.json({ message: "Promotion deleted" });
  } catch (error) {
    return apiError("Failed to delete promotion", error);
  }
}
