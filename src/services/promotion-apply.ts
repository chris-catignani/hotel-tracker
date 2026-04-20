import prisma from "@/lib/prisma";
import { BookingPromotion, Prisma } from "@prisma/client";
import { resolveCalcCurrencyRate } from "./exchange-rate";
import {
  calculateMatchedPromotions,
  getConstrainedPromotions,
  type MatchedPromotion,
  BOOKING_INCLUDE,
  PROMOTIONS_INCLUDE,
} from "@/lib/promotion-matching";
import { fetchPromotionUsage } from "./promotion-usage";

/**
 * Persists matched promotions to a booking, replacing existing auto-applied ones.
 * The delete-and-recreate is wrapped in a transaction so no concurrent reader can
 * observe the booking in a zero-BP state between the two operations.
 */
async function applyMatchedPromotions(
  bookingId: string,
  matched: MatchedPromotion[]
): Promise<BookingPromotion[]> {
  // Verify booking still exists to avoid foreign key violations in concurrent re-evaluations
  const bookingExists = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true },
  });

  if (!bookingExists) {
    console.warn(`applyMatchedPromotions: Booking ${bookingId} not found, skipping.`);
    return [];
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Preserve user-set posting statuses before deleting so they survive re-evaluation
      const existingStatuses = await tx.bookingPromotion.findMany({
        where: { bookingId, autoApplied: true },
        select: { promotionId: true, postingStatus: true },
      });
      const postingStatusByPromoId = new Map(
        existingStatuses.map((bp) => [bp.promotionId, bp.postingStatus])
      );

      // Delete existing auto-applied BookingPromotions for this booking
      await tx.bookingPromotion.deleteMany({
        where: {
          bookingId,
          autoApplied: true,
        },
      });

      // Create new BookingPromotion records with benefit applications
      const createdRecords: BookingPromotion[] = [];
      for (const match of matched) {
        const record = await tx.bookingPromotion.create({
          data: {
            bookingId,
            promotionId: match.promotionId,
            appliedValue: match.appliedValue,
            bonusPointsApplied: match.bonusPointsApplied > 0 ? match.bonusPointsApplied : null,
            autoApplied: true,
            postingStatus: postingStatusByPromoId.get(match.promotionId) ?? "pending",
            eligibleNightsAtBooking: match.eligibleNightsAtBooking,
            isOrphaned: match.isOrphaned ?? false,
            isPreQualifying: match.isPreQualifying ?? false,
            benefitApplications: {
              create: match.benefitApplications.map((ba) => ({
                promotionBenefitId: ba.promotionBenefitId,
                appliedValue: ba.appliedValue,
                bonusPointsApplied: ba.bonusPointsApplied > 0 ? ba.bonusPointsApplied : null,
                eligibleNightsAtBooking: ba.eligibleNightsAtBooking,
                isOrphaned: ba.isOrphaned ?? false,
                isPreQualifying: ba.isPreQualifying ?? false,
              })),
            },
          },
        });
        createdRecords.push(record);
      }
      return createdRecords;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2025")
    ) {
      console.warn(`applyMatchedPromotions: Booking ${bookingId} was likely deleted concurrently.`);
      return [];
    }
    throw error;
  }
}

/**
 * Re-evaluates and applies promotions for a list of booking IDs sequentially.
 * Processes bookings one at a time to ensure accurate redemption constraint checks.
 */
export async function reevaluateBookings(bookingIds: string[], userId: string): Promise<void> {
  if (bookingIds.length === 0) return;

  const activePromotions = (
    await prisma.promotion.findMany({
      where: { userId },
      include: PROMOTIONS_INCLUDE,
    })
  ).map((p) => ({
    ...p,
    registrationDate: p.userPromotions ? p.userPromotions.registrationDate : null,
  }));

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds }, userId },
    include: BOOKING_INCLUDE,
    orderBy: { checkIn: "asc" },
  });

  // Get all promotions with constraints (including tier-based stay counting)
  const constrainedPromos = getConstrainedPromotions(activePromotions);

  // Pre-fetch all needed rates in parallel before the loop (booking currencies for future
  // non-USD stays, and chain calculationCurrencies for chains like Accor that earn in EUR)
  const currenciesToResolve = new Set<string>();
  for (const b of bookings) {
    if (b.currency !== "USD" && b.lockedExchangeRate == null) currenciesToResolve.add(b.currency);
    const cc = b.hotelChain?.calculationCurrency;
    if (cc && cc !== "USD") currenciesToResolve.add(cc);
  }
  const rateCache = new Map<string, number | null>();
  const currencyList = Array.from(currenciesToResolve);
  const rateResults = await Promise.allSettled(currencyList.map((c) => resolveCalcCurrencyRate(c)));
  for (let i = 0; i < currencyList.length; i++) {
    const result = rateResults[i];
    rateCache.set(currencyList[i], result.status === "fulfilled" ? result.value : null);
  }

  // Process sequentially to ensure accurate constraint checks
  for (const booking of bookings) {
    // lockedExchangeRate is null for future non-USD bookings until check-in
    let resolvedExchangeRate: number;
    if (booking.currency === "USD") {
      resolvedExchangeRate = 1;
    } else if (booking.lockedExchangeRate != null) {
      resolvedExchangeRate = Number(booking.lockedExchangeRate);
    } else {
      resolvedExchangeRate = rateCache.get(booking.currency) ?? 1;
    }

    const calcCurrency = booking.hotelChain?.calculationCurrency;
    const calcCurrencyToUsdRate = calcCurrency ? (rateCache.get(calcCurrency) ?? null) : null;

    const bookingWithRate = {
      ...booking,
      lockedExchangeRate: resolvedExchangeRate,
      hotelChain: booking.hotelChain
        ? { ...booking.hotelChain, calcCurrencyToUsdRate }
        : booking.hotelChain,
    };

    const priorUsage = await fetchPromotionUsage(
      constrainedPromos,
      bookingWithRate,
      userId,
      booking.id
    );
    const matched = calculateMatchedPromotions(bookingWithRate, activePromotions, priorUsage);

    await applyMatchedPromotions(booking.id, matched);
  }
}

/**
 * Re-evaluates and applies promotions for a single booking.
 * Returns the list of promotion IDs that were applied.
 */
export async function matchPromotionsForBooking(
  bookingId: string,
  userId: string
): Promise<string[]> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: BOOKING_INCLUDE,
  });

  if (!booking) {
    throw new Error(`Booking with id ${bookingId} not found`);
  }

  // Resolve exchange rate for USD-based cost calculations
  // For past/USD bookings, exchangeRate is already set; for future non-USD, fetch current rate
  let resolvedExchangeRate: number = 1;
  if (booking.currency === "USD") {
    resolvedExchangeRate = 1;
  } else if (booking.lockedExchangeRate != null) {
    resolvedExchangeRate = Number(booking.lockedExchangeRate);
  } else {
    resolvedExchangeRate = (await resolveCalcCurrencyRate(booking.currency)) ?? 1;
  }
  const calcCurrency = booking.hotelChain?.calculationCurrency;
  const calcCurrencyToUsdRate =
    calcCurrency && calcCurrency !== "USD" ? await resolveCalcCurrencyRate(calcCurrency) : null;

  const bookingWithRate = {
    ...booking,
    lockedExchangeRate: resolvedExchangeRate,
    hotelChain: booking.hotelChain
      ? { ...booking.hotelChain, calcCurrencyToUsdRate }
      : booking.hotelChain,
  };

  const activePromotions = (
    await prisma.promotion.findMany({
      where: { userId },
      include: PROMOTIONS_INCLUDE,
    })
  ).map((p) => ({
    ...p,
    registrationDate: p.userPromotions ? p.userPromotions.registrationDate : null,
  }));

  // Get all promotions with constraints (including tier-based stay counting)
  const constrainedPromos = getConstrainedPromotions(activePromotions);

  // Fetch prior usage excluding current booking
  const priorUsage = await fetchPromotionUsage(
    constrainedPromos,
    bookingWithRate,
    userId,
    bookingId
  );

  const matched = calculateMatchedPromotions(bookingWithRate, activePromotions, priorUsage);
  await applyMatchedPromotions(bookingId, matched);
  return matched.map((m) => m.promotionId);
}

/**
 * Finds all bookings potentially affected by changes to a list of promotions.
 * This includes bookings that already have the promotion applied AND bookings
 * that match the promotion's core criteria (hotel chain, dates, etc.).
 */
export async function getAffectedBookingIds(
  promotionIds: string[],
  userId: string
): Promise<string[]> {
  if (promotionIds.length === 0) return [];

  const promotions = await prisma.promotion.findMany({
    where: { id: { in: promotionIds }, userId },
  });

  if (promotions.length === 0) return [];

  const orConditions = promotions.map((promotion) => {
    const coreConditions = [
      { hotelChainId: promotion.hotelChainId ?? undefined },
      promotion.creditCardId
        ? { userCreditCard: { creditCardId: promotion.creditCardId } }
        : { userCreditCardId: undefined },
      { shoppingPortalId: promotion.shoppingPortalId ?? undefined },
      {
        bookingPromotions: {
          some: { promotionId: promotion.id },
        },
      },
    ].filter((condition) => {
      const firstKey = Object.keys(condition)[0] as keyof typeof condition;
      const value = condition[firstKey];
      return value !== undefined && value !== null;
    });

    return {
      AND: [
        { OR: coreConditions },
        {
          checkIn: {
            gte: promotion.startDate ?? undefined,
            lte: promotion.endDate ?? undefined,
          },
        },
      ],
    };
  });

  const affectedBookings = await prisma.booking.findMany({
    where: {
      userId,
      OR: orConditions,
    },
    select: { id: true },
  });

  // Use a Set to handle bookings affected by multiple promotions
  const allAffectedIds = new Set(affectedBookings.map((b) => b.id));
  return Array.from(allAffectedIds);
}

/**
 * Re-evaluates and applies promotions for all bookings potentially affected by a promotion change.
 */
export async function matchPromotionsForAffectedBookings(
  promotionId: string,
  userId: string
): Promise<void> {
  const affectedBookingIds = await getAffectedBookingIds([promotionId], userId);
  await reevaluateBookings(affectedBookingIds, userId);
}

/**
 * Finds all bookings that occur after a given check-in date.
 */
export async function getSubsequentBookingIds(checkIn: Date, userId: string): Promise<string[]> {
  const subsequentBookings = await prisma.booking.findMany({
    where: {
      userId,
      checkIn: {
        gt: checkIn,
      },
    },
    select: { id: true },
    orderBy: { checkIn: "asc" },
  });

  return subsequentBookings.map((b) => b.id);
}

/**
 * Re-evaluates all bookings that occur after a given booking.
 * This is necessary because changes to an earlier booking can affect the
 * redemption capacity and eligibility for chronologically later stays.
 *
 * Optimization: If promotionIds are provided, only re-evaluates subsequent
 * bookings that either currently have one of those promotions or could
 * potentially match them.
 */
export async function reevaluateSubsequentBookings(
  bookingId: string,
  userId: string,
  promotionIds?: string[]
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { checkIn: true },
  });

  if (!booking) return;

  let queryIds: string[] = [];

  if (promotionIds && promotionIds.length > 0) {
    // Optimized path: only find bookings after this stay that match the same promos
    const affected = await prisma.booking.findMany({
      where: {
        userId,
        checkIn: { gt: booking.checkIn },
        bookingPromotions: {
          some: {
            promotionId: { in: promotionIds },
          },
        },
      },
      select: { id: true },
      orderBy: { checkIn: "asc" },
    });
    queryIds = affected.map((b) => b.id);
  } else {
    // Fallback: re-evaluate all future bookings (e.g. on deletion where we don't know what matched)
    queryIds = await getSubsequentBookingIds(booking.checkIn, userId);
  }

  if (queryIds.length > 0) {
    await reevaluateBookings(queryIds, userId);
  }
}
