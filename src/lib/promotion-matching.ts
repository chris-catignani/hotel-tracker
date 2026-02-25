import prisma from "@/lib/prisma";
import {
  BookingPromotion,
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";

export type PromotionUsage = {
  count: number;
  totalValue: number;
  totalBonusPoints: number;
  eligibleStayCount?: number;
  appliedSubBrandIds?: Set<number | null>;
};
export type PromotionUsageMap = Map<number, PromotionUsage>;

const BOOKING_INCLUDE = {
  hotelChain: { include: { pointType: true } },
  hotelChainSubBrand: true,
  creditCard: { include: { pointType: true } },
  shoppingPortal: true,
} as const;

type MatchingBenefit = {
  id: number;
  rewardType: PromotionRewardType;
  valueType: PromotionBenefitValueType;
  value: Prisma.Decimal;
  certType: string | null;
  pointsMultiplierBasis: string | null;
  isTieIn?: boolean;
  sortOrder: number;
};

const PROMOTIONS_INCLUDE = {
  benefits: { orderBy: { sortOrder: "asc" as const } },
  tiers: {
    orderBy: { minStays: "asc" as const },
    include: { benefits: { orderBy: { sortOrder: "asc" as const } } },
  },
  exclusions: true,
  tieInCards: true,
  userPromotions: true,
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
  oncePerSubBrand: boolean;
  registrationDeadline: Date | null;
  validDaysAfterRegistration: number | null;
  registrationDate?: Date | null;
  tieInCards: { creditCardId: number }[];
  tieInRequiresPayment: boolean;
  benefits: MatchingBenefit[];
  tiers: { id: number; minStays: number; maxStays: number | null; benefits: MatchingBenefit[] }[];
  exclusions: { hotelChainSubBrandId: number }[];
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

    // Exclusion check: if booking's sub-brand is in the exclusion list, skip
    if (
      promo.exclusions.length > 0 &&
      booking.hotelChainSubBrandId != null &&
      promo.exclusions.some((e) => e.hotelChainSubBrandId === booking.hotelChainSubBrandId)
    )
      continue;

    // Date range check
    const checkInDate = new Date(booking.checkIn);

    // Global start date check
    if (promo.startDate && checkInDate < new Date(promo.startDate)) continue;

    // Registration deadline check: if user registered after deadline, promo is invalid
    if (promo.registrationDate && promo.registrationDeadline) {
      if (new Date(promo.registrationDate) > new Date(promo.registrationDeadline)) continue;
    }

    // Registration-based duration check
    if (promo.registrationDate && promo.validDaysAfterRegistration) {
      const regDate = new Date(promo.registrationDate);
      const effectiveEndDate = new Date(regDate);
      effectiveEndDate.setDate(regDate.getDate() + promo.validDaysAfterRegistration);

      // Promotion is valid from registration date until duration expires
      if (checkInDate < regDate) continue;
      if (checkInDate > effectiveEndDate) continue;
    } else if (promo.endDate) {
      // Fallback to global end date if no registration-based duration is set
      if (checkInDate > new Date(promo.endDate)) continue;
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

    // Once per sub-brand check: promotion can only apply once per sub-brand
    if (promo.oncePerSubBrand) {
      const appliedSubBrands = usage?.appliedSubBrandIds;
      if (appliedSubBrands?.has(booking.hotelChainSubBrandId ?? null)) continue;
    }

    // Determine which benefits to use: tier-based or flat
    let activeBenefits: MatchingBenefit[];
    if (promo.tiers.length > 0) {
      const priorMatchedStays = usage?.eligibleStayCount ?? 0;
      const currentStayNumber = priorMatchedStays + 1;
      const applicableTier = promo.tiers.find(
        (tier) =>
          currentStayNumber >= tier.minStays &&
          (tier.maxStays === null || currentStayNumber <= tier.maxStays)
      );
      if (!applicableTier) continue; // no tier covers this stay count
      activeBenefits = applicableTier.benefits;
    } else {
      activeBenefits = promo.benefits;
    }

    // Determine if the booking satisfies the tie-in card condition
    const hasTieIn =
      promo.tieInCards.length === 0 ||
      (booking.creditCardId !== null &&
        promo.tieInCards.some((c) => c.creditCardId === booking.creditCardId));

    // Filter benefits by tie-in eligibility
    const eligibleBenefits = activeBenefits.filter((b) => !b.isTieIn || hasTieIn);

    // If all benefits are tie-in and the booking doesn't have the tie-in card, skip
    if (eligibleBenefits.length === 0) continue;

    // Calculate applied value per benefit
    const centsPerPoint = booking.hotelChain?.pointType?.centsPerPoint
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : 0.01;

    const benefitApplications: BenefitApplication[] = [];
    let totalAppliedValue = 0;
    let totalBonusPoints = 0;

    for (const benefit of eligibleBenefits) {
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
      if (totalAppliedValue > remainingCapacity) {
        const ratio = remainingCapacity / totalAppliedValue;
        // Scale down each benefit application proportionally
        for (const benefit of benefitApplications) {
          benefit.appliedValue *= ratio;
        }
        totalAppliedValue = remainingCapacity;
      }
    }

    // Apply maxTotalBonusPoints cap
    if (promo.maxTotalBonusPoints) {
      const priorPoints = usage?.totalBonusPoints ?? 0;
      const remainingPoints = Math.max(0, promo.maxTotalBonusPoints - priorPoints);
      if (remainingPoints <= 0) continue;
      if (totalBonusPoints > remainingPoints) {
        const ratio = remainingPoints / totalBonusPoints;
        // Scale down each benefit application proportionally
        for (const benefit of benefitApplications) {
          benefit.appliedValue *= ratio;
        }
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
  promotions: MatchingPromotion[],
  booking: MatchingBooking,
  excludeBookingId?: number
): Promise<PromotionUsageMap> {
  const usageMap: PromotionUsageMap = new Map();

  const promotionIds = promotions.map((p) => p.id);
  if (promotionIds.length === 0) return usageMap;

  // Single aggregation query to get count, totalValue, and totalBonusPoints
  const usage = await prisma.bookingPromotion.groupBy({
    by: ["promotionId"],
    where: {
      promotionId: { in: promotionIds },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
    },
    _count: { id: true },
    _sum: { appliedValue: true, bonusPointsApplied: true },
  });

  for (const row of usage) {
    usageMap.set(row.promotionId, {
      count: row._count.id,
      totalValue: Number(row._sum.appliedValue ?? 0),
      totalBonusPoints: row._sum.bonusPointsApplied ?? 0,
    });
  }

  // Fetch eligibleStayCount for tiered promotions
  // Counts all bookings matching criteria with checkIn before the current booking,
  // regardless of whether the promotion was actually applied (so gaps in tiers don't
  // break the stay number counter).
  const tieredPromos = promotions.filter((p) => p.tiers.length > 0);
  for (const promo of tieredPromos) {
    const currentCheckIn = new Date(booking.checkIn);
    const eligibleCount = await prisma.booking.count({
      where: {
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        hotelChainId: promo.hotelChainId ?? undefined,
        ...(promo.hotelChainSubBrandId !== null
          ? { hotelChainSubBrandId: promo.hotelChainSubBrandId }
          : {}),
        ...(promo.creditCardId !== null ? { creditCardId: promo.creditCardId } : {}),
        ...(promo.shoppingPortalId !== null ? { shoppingPortalId: promo.shoppingPortalId } : {}),
        checkIn: {
          ...(promo.startDate ? { gte: promo.startDate } : {}),
          lt: currentCheckIn,
          ...(promo.endDate ? { lte: promo.endDate } : {}),
        },
      },
    });
    const existing = usageMap.get(promo.id) ?? { count: 0, totalValue: 0, totalBonusPoints: 0 };
    usageMap.set(promo.id, { ...existing, eligibleStayCount: eligibleCount });
  }

  // Fetch appliedSubBrandIds for oncePerSubBrand promotions
  const oncePerSubBrandPromos = promotions.filter((p) => p.oncePerSubBrand);
  if (oncePerSubBrandPromos.length > 0) {
    const oncePerSubBrandPromoIds = oncePerSubBrandPromos.map((p) => p.id);
    const appliedBookings = await prisma.bookingPromotion.findMany({
      where: {
        promotionId: { in: oncePerSubBrandPromoIds },
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      },
      select: {
        promotionId: true,
        booking: { select: { hotelChainSubBrandId: true } },
      },
    });

    const subBrandsByPromo = new Map<number, Set<number | null>>();
    for (const promo of oncePerSubBrandPromos) {
      subBrandsByPromo.set(promo.id, new Set());
    }
    for (const bp of appliedBookings) {
      subBrandsByPromo.get(bp.promotionId)?.add(bp.booking.hotelChainSubBrandId);
    }

    for (const promo of oncePerSubBrandPromos) {
      const existing = usageMap.get(promo.id) ?? { count: 0, totalValue: 0, totalBonusPoints: 0 };
      usageMap.set(promo.id, { ...existing, appliedSubBrandIds: subBrandsByPromo.get(promo.id) });
    }
  }

  return usageMap;
}

/**
 * Re-evaluates and applies promotions for a list of booking IDs sequentially.
 * Processes bookings one at a time to ensure accurate redemption constraint checks.
 */
export async function reevaluateBookings(bookingIds: number[]): Promise<void> {
  if (bookingIds.length === 0) return;

  const activePromotions = (
    await prisma.promotion.findMany({
      where: { isActive: true },
      include: PROMOTIONS_INCLUDE,
    })
  ).map((p) => ({
    ...p,
    registrationDate: p.userPromotions[0]?.registrationDate ?? null,
  }));

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: BOOKING_INCLUDE,
    orderBy: { checkIn: "asc" },
  });

  // Get all promotions with constraints (including tier-based stay counting)
  const constrainedPromos = activePromotions.filter(
    (p) =>
      p.isSingleUse ||
      p.maxRedemptionCount ||
      p.maxRedemptionValue ||
      p.maxTotalBonusPoints ||
      p.tiers.length > 0 ||
      p.oncePerSubBrand
  );

  // Process sequentially to ensure accurate constraint checks
  for (const booking of bookings) {
    const priorUsage = await fetchPromotionUsage(constrainedPromos, booking, booking.id);
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

  const activePromotions = (
    await prisma.promotion.findMany({
      where: { isActive: true },
      include: PROMOTIONS_INCLUDE,
    })
  ).map((p) => ({
    ...p,
    registrationDate: p.userPromotions[0]?.registrationDate ?? null,
  }));

  // Get all promotions with constraints (including tier-based stay counting)
  const constrainedPromos = activePromotions.filter(
    (p) =>
      p.isSingleUse ||
      p.maxRedemptionCount ||
      p.maxRedemptionValue ||
      p.maxTotalBonusPoints ||
      p.tiers.length > 0 ||
      p.oncePerSubBrand
  );

  // Fetch prior usage excluding current booking
  const priorUsage = await fetchPromotionUsage(constrainedPromos, booking, bookingId);

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
      AND: [
        {
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
        // Date range filtering: only bookings that could potentially match the promotion
        {
          checkIn: {
            gte: promotion.startDate ?? undefined,
            lte: promotion.endDate ?? undefined,
          },
        },
      ],
    },
    select: { id: true },
  });

  await reevaluateBookings(affectedBookings.map((b) => b.id));
}
