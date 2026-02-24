import prisma from "@/lib/prisma";
import {
  BookingPromotion,
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";

export type PromotionUsage = { count: number; totalValue: number; totalBonusPoints: number };
export type PromotionUsageMap = Map<number, PromotionUsage>;

const BOOKING_INCLUDE = {
  hotelChain: { include: { pointType: true } },
  hotelChainSubBrand: true,
  creditCard: { include: { pointType: true } },
  shoppingPortal: true,
} as const;

const PROMOTIONS_INCLUDE = {
  benefits: { orderBy: { sortOrder: "asc" as const } },
} as const;

export interface MatchingBooking {
  creditCardId: number | null;
  shoppingPortalId: number | null;
  hotelChainId: number | null;
  hotelChainSubBrandId: number | null;
  checkIn: Date | string;
  createdAt: Date | string;
  numNights: number;
  pretaxCost: string | number | Prisma.Decimal;
  totalCost: string | number | Prisma.Decimal;
  loyaltyPointsEarned: number | null;
  hotelChain?: {
    basePointRate?: string | number | Prisma.Decimal | null;
    pointType?: {
      centsPerPoint: string | number | Prisma.Decimal | null;
    } | null;
  } | null;
  creditCard?: {
    pointType?: {
      centsPerPoint: string | number | Prisma.Decimal | null;
    } | null;
  } | null;
}

interface MatchingPromotion {
  id: number;
  type: PromotionType;
  creditCardId: number | null;
  shoppingPortalId: number | null;
  hotelChainId: number | null;
  hotelChainSubBrandId: number | null;
  startDate: Date | null;
  endDate: Date | null;
  minSpend: Prisma.Decimal | null;
  isActive: boolean;
  isSingleUse: boolean;
  maxRedemptionCount: number | null;
  maxRedemptionValue: Prisma.Decimal | null;
  maxTotalBonusPoints: number | null;
  minNightsRequired: number | null;
  nightsStackable: boolean;
  bookByDate: Date | null;
  benefits: {
    id: number;
    rewardType: PromotionRewardType;
    valueType: PromotionBenefitValueType;
    value: Prisma.Decimal;
    certType: string | null;
    pointsMultiplierBasis: string | null;
    sortOrder: number;
  }[];
}

interface BenefitApplication {
  promotionBenefitId: number;
  appliedValue: number;
}

interface MatchedPromotion {
  promotionId: number;
  appliedValue: number;
  bonusPointsApplied: number;
  benefitApplications: BenefitApplication[];
}

/**
 * Calculates which promotions match a given booking without side effects.
 */
export function calculateMatchedPromotions(
  booking: MatchingBooking,
  activePromotions: MatchingPromotion[],
  priorUsage?: PromotionUsageMap
) {
  const matched: MatchedPromotion[] = [];

  for (const promo of activePromotions) {
    let typeMatches = false;

    switch (promo.type) {
      case PromotionType.credit_card:
        typeMatches = promo.creditCardId === booking.creditCardId;
        break;
      case PromotionType.portal:
        typeMatches = promo.shoppingPortalId === booking.shoppingPortalId;
        break;
      case PromotionType.loyalty:
        typeMatches = promo.hotelChainId === booking.hotelChainId;
        break;
    }

    if (!typeMatches) continue;

    // Sub-brand filter: if promo is scoped to a sub-brand, booking must match
    if (
      promo.hotelChainSubBrandId !== null &&
      promo.hotelChainSubBrandId !== booking.hotelChainSubBrandId
    )
      continue;

    // Date range check
    if (promo.startDate || promo.endDate) {
      const checkInDate = new Date(booking.checkIn);
      if (promo.startDate && checkInDate < new Date(promo.startDate)) continue;
      if (promo.endDate && checkInDate > new Date(promo.endDate)) continue;
    }

    // Min spend check for credit_card types
    if (
      promo.type === PromotionType.credit_card &&
      promo.minSpend !== null &&
      Number(booking.totalCost) < Number(promo.minSpend)
    ) {
      continue;
    }

    // Redemption constraint checks
    const usage = priorUsage?.get(promo.id);
    if (promo.isSingleUse && usage && usage.count >= 1) continue;
    if (promo.maxRedemptionCount && usage && usage.count >= promo.maxRedemptionCount) continue;

    // Book-by-date check
    if (promo.bookByDate) {
      const bookingCreatedDate = new Date(booking.createdAt);
      if (bookingCreatedDate > new Date(promo.bookByDate)) continue;
    }

    // Minimum nights check
    if (promo.minNightsRequired && booking.numNights < promo.minNightsRequired) {
      continue;
    }

    // Calculate applied value per benefit
    const centsPerPoint = booking.hotelChain?.pointType?.centsPerPoint
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : 0.01;

    const benefitApplications: BenefitApplication[] = [];
    let totalAppliedValue = 0;
    let totalBonusPoints = 0;

    for (const benefit of promo.benefits) {
      const benefitValue = Number(benefit.value);
      let appliedValue = 0;
      let benefitBonusPoints = 0;

      switch (benefit.rewardType) {
        case PromotionRewardType.cashback:
          if (benefit.valueType === PromotionBenefitValueType.fixed) {
            appliedValue = benefitValue;
          } else if (benefit.valueType === PromotionBenefitValueType.percentage) {
            appliedValue = (Number(booking.totalCost) * benefitValue) / 100;
          }
          break;
        case PromotionRewardType.points:
          if (benefit.valueType === PromotionBenefitValueType.multiplier) {
            const isBaseOnly =
              !benefit.pointsMultiplierBasis || benefit.pointsMultiplierBasis === "base_only";
            const baseRate = booking.hotelChain?.basePointRate;
            const basisPoints =
              isBaseOnly && baseRate != null
                ? Number(booking.pretaxCost) * Number(baseRate)
                : Number(booking.loyaltyPointsEarned || 0);
            appliedValue = basisPoints * (benefitValue - 1) * centsPerPoint;
            benefitBonusPoints = Math.round(basisPoints * (benefitValue - 1));
          } else {
            appliedValue = benefitValue * centsPerPoint;
            benefitBonusPoints = Math.round(benefitValue);
          }
          break;
        case PromotionRewardType.certificate:
        case PromotionRewardType.eqn:
          appliedValue = 0; // informational only
          break;
      }

      benefitApplications.push({
        promotionBenefitId: benefit.id,
        appliedValue,
      });
      totalAppliedValue += appliedValue;
      totalBonusPoints += benefitBonusPoints;
    }

    // Apply nightsStackable multiplier
    if (promo.nightsStackable && promo.minNightsRequired && promo.minNightsRequired > 0) {
      const multiplier = Math.floor(booking.numNights / promo.minNightsRequired);
      totalAppliedValue *= multiplier;
      totalBonusPoints *= multiplier;
    }

    // Apply maxRedemptionValue cap
    if (promo.maxRedemptionValue) {
      const maxValue = Number(promo.maxRedemptionValue);
      const priorValue = usage?.totalValue ?? 0;
      const remainingCapacity = Math.max(0, maxValue - priorValue);
      if (remainingCapacity <= 0) continue;
      totalAppliedValue = Math.min(totalAppliedValue, remainingCapacity);
    }

    // Apply maxTotalBonusPoints cap
    if (promo.maxTotalBonusPoints) {
      const priorPoints = usage?.totalBonusPoints ?? 0;
      const remainingPoints = Math.max(0, promo.maxTotalBonusPoints - priorPoints);
      if (remainingPoints <= 0) continue;
      if (totalBonusPoints > remainingPoints) {
        const ratio = remainingPoints / totalBonusPoints;
        totalAppliedValue = totalAppliedValue * ratio;
        totalBonusPoints = remainingPoints;
      }
    }

    matched.push({
      promotionId: promo.id,
      appliedValue: totalAppliedValue,
      bonusPointsApplied: totalBonusPoints,
      benefitApplications,
    });
  }

  return matched;
}

/**
 * Persists matched promotions to a booking, replacing existing auto-applied ones.
 */
async function applyMatchedPromotions(
  bookingId: number,
  matched: MatchedPromotion[]
): Promise<BookingPromotion[]> {
  // Delete existing auto-applied BookingPromotions for this booking
  await prisma.bookingPromotion.deleteMany({
    where: {
      bookingId,
      autoApplied: true,
    },
  });

  // Create new BookingPromotion records with benefit applications
  const createdRecords: BookingPromotion[] = [];
  for (const match of matched) {
    const record = await prisma.bookingPromotion.create({
      data: {
        bookingId,
        promotionId: match.promotionId,
        appliedValue: match.appliedValue,
        bonusPointsApplied: match.bonusPointsApplied > 0 ? match.bonusPointsApplied : null,
        autoApplied: true,
        benefitApplications: {
          create: match.benefitApplications.map((ba) => ({
            promotionBenefitId: ba.promotionBenefitId,
            appliedValue: ba.appliedValue,
          })),
        },
      },
    });
    createdRecords.push(record);
  }

  return createdRecords;
}

/**
 * Fetches prior usage statistics for promotions with redemption constraints.
 */
async function fetchPromotionUsage(
  promotionIds: number[],
  excludeBookingId?: number
): Promise<PromotionUsageMap> {
  const usageMap: PromotionUsageMap = new Map();

  if (promotionIds.length === 0) return usageMap;

  // Get count and totalValue for each promotion
  const countAndValue = await prisma.bookingPromotion.groupBy({
    by: ["promotionId"],
    where: {
      promotionId: { in: promotionIds },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
    },
    _count: { id: true },
    _sum: { appliedValue: true },
  });

  // Get totalBonusPoints for each promotion
  const bonusPoints = await prisma.bookingPromotion.findMany({
    where: {
      promotionId: { in: promotionIds },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
    },
    select: { promotionId: true, bonusPointsApplied: true },
  });

  const bonusPointsByPromo = new Map<number, number>();
  for (const bp of bonusPoints) {
    const current = bonusPointsByPromo.get(bp.promotionId) ?? 0;
    bonusPointsByPromo.set(bp.promotionId, current + (bp.bonusPointsApplied ?? 0));
  }

  for (const row of countAndValue) {
    usageMap.set(row.promotionId, {
      count: row._count.id,
      totalValue: Number(row._sum.appliedValue ?? 0),
      totalBonusPoints: bonusPointsByPromo.get(row.promotionId) ?? 0,
    });
  }

  return usageMap;
}

/**
 * Re-evaluates and applies promotions for a list of booking IDs sequentially.
 * Processes bookings one at a time to ensure accurate redemption constraint checks.
 */
export async function reevaluateBookings(bookingIds: number[]): Promise<void> {
  if (bookingIds.length === 0) return;

  const activePromotions = await prisma.promotion.findMany({
    where: { isActive: true },
    include: PROMOTIONS_INCLUDE,
  });

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: BOOKING_INCLUDE,
  });

  // Get all promotion IDs with constraints
  const constrainedPromoIds = activePromotions
    .filter(
      (p) => p.isSingleUse || p.maxRedemptionCount || p.maxRedemptionValue || p.maxTotalBonusPoints
    )
    .map((p) => p.id);

  // Process sequentially to ensure accurate constraint checks
  for (const booking of bookings) {
    const priorUsage = await fetchPromotionUsage(constrainedPromoIds, booking.id);
    const matched = calculateMatchedPromotions(booking, activePromotions, priorUsage);
    await applyMatchedPromotions(booking.id, matched);
  }
}

/**
 * Re-evaluates and applies promotions for a single booking.
 */
export async function matchPromotionsForBooking(bookingId: number): Promise<BookingPromotion[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: BOOKING_INCLUDE,
  });

  if (!booking) {
    throw new Error(`Booking with id ${bookingId} not found`);
  }

  const activePromotions = await prisma.promotion.findMany({
    where: { isActive: true },
    include: PROMOTIONS_INCLUDE,
  });

  // Get all promotion IDs with constraints
  const constrainedPromoIds = activePromotions
    .filter(
      (p) => p.isSingleUse || p.maxRedemptionCount || p.maxRedemptionValue || p.maxTotalBonusPoints
    )
    .map((p) => p.id);

  // Fetch prior usage excluding current booking
  const priorUsage = await fetchPromotionUsage(constrainedPromoIds, bookingId);

  const matched = calculateMatchedPromotions(booking, activePromotions, priorUsage);
  return applyMatchedPromotions(bookingId, matched);
}

/**
 * Re-evaluates and applies promotions for all bookings potentially affected by a promotion change.
 * Minimizes database calls by fetching active promotions once and processing bookings in parallel.
 */
export async function matchPromotionsForAffectedBookings(promotionId: number): Promise<void> {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
  });

  if (!promotion) return;

  // Find bookings that match the promotion's core criteria or already have it applied
  const affectedBookings = await prisma.booking.findMany({
    where: {
      OR: [
        { hotelChainId: promotion.hotelChainId ?? undefined },
        { creditCardId: promotion.creditCardId ?? undefined },
        { shoppingPortalId: promotion.shoppingPortalId ?? undefined },
        {
          bookingPromotions: {
            some: { promotionId: promotion.id },
          },
        },
      ].filter((condition) => {
        // Remove conditions that are undefined/null to avoid matching everything
        const value = Object.values(condition)[0];
        return value !== undefined && value !== null;
      }),
    },
    select: { id: true },
  });

  await reevaluateBookings(affectedBookings.map((b) => b.id));
}
