import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings, reevaluateBookings } from "@/lib/promotion-matching";
import { PromotionBenefitFormData } from "@/lib/types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const promotion = await prisma.promotion.findUnique({
      where: { id: Number(id) },
      include: {
        hotelChain: true,
        hotelChainSubBrand: true,
        creditCard: true,
        shoppingPortal: true,
        benefits: { orderBy: { sortOrder: "asc" } },
      },
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
    } = body;

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

    // Replace benefits wholesale inside a transaction: delete all then recreate
    if (benefits !== undefined) {
      data.benefits = {
        create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) => ({
          rewardType: b.rewardType,
          valueType: b.valueType,
          value: Number(b.value),
          certType: b.certType || null,
          pointsMultiplierBasis: b.pointsMultiplierBasis || null,
          sortOrder: b.sortOrder ?? i,
        })),
      };
    }

    const promotion = await prisma.$transaction(async (tx) => {
      if (benefits !== undefined) {
        await tx.promotionBenefit.deleteMany({ where: { promotionId: Number(id) } });
      }
      return tx.promotion.update({
        where: { id: Number(id) },
        data,
        include: {
          benefits: { orderBy: { sortOrder: "asc" } },
        },
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
      where: {
        bookingPromotions: {
          some: { promotionId },
        },
      },
      select: { id: true },
    });

    await prisma.promotion.delete({
      where: { id: promotionId },
    });

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
