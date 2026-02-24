import prisma from "@/lib/prisma";
import {
  BookingPromotion,
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";

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
  totalCost: string | number | Prisma.Decimal;
  loyaltyPointsEarned: number | null;
  hotelChain?: {
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
  benefits: {
    id: number;
    rewardType: PromotionRewardType;
    valueType: PromotionBenefitValueType;
    value: Prisma.Decimal;
    certType: string | null;
    sortOrder: number;
  }[];
}

interface BenefitApplication {
  promotionBenefitId: number;
  appliedValue: number;
}

/**
 * Calculates which promotions match a given booking without side effects.
 */
export function calculateMatchedPromotions(
  booking: MatchingBooking,
  activePromotions: MatchingPromotion[]
) {
  const matched: {
    promotionId: number;
    appliedValue: number;
    benefitApplications: BenefitApplication[];
  }[] = [];

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

    // Calculate applied value per benefit
    const centsPerPoint = booking.hotelChain?.pointType?.centsPerPoint
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : 0.01;

    const benefitApplications: BenefitApplication[] = [];
    let totalAppliedValue = 0;

    for (const benefit of promo.benefits) {
      const benefitValue = Number(benefit.value);
      let appliedValue = 0;

      switch (benefit.rewardType) {
        case PromotionRewardType.cashback:
          if (benefit.valueType === PromotionBenefitValueType.fixed) {
            appliedValue = benefitValue;
          } else if (benefit.valueType === PromotionBenefitValueType.percentage) {
            appliedValue = (Number(booking.totalCost) * benefitValue) / 100;
          }
          break;
        case PromotionRewardType.points_multiplier:
          appliedValue =
            Number(booking.loyaltyPointsEarned || 0) * (benefitValue - 1) * centsPerPoint;
          break;
        case PromotionRewardType.fixed_points:
          appliedValue = benefitValue * centsPerPoint;
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
    }

    matched.push({
      promotionId: promo.id,
      appliedValue: totalAppliedValue,
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
  matched: {
    promotionId: number;
    appliedValue: number;
    benefitApplications: BenefitApplication[];
  }[]
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
 * Re-evaluates and applies promotions for a list of booking IDs.
 * Minimizes database calls by fetching active promotions once.
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

  await Promise.all(
    bookings.map((booking) => {
      const matched = calculateMatchedPromotions(booking, activePromotions);
      return applyMatchedPromotions(booking.id, matched);
    })
  );
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

  const matched = calculateMatchedPromotions(booking, activePromotions);
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
