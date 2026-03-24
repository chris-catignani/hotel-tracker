import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import {
  getCurrentRate,
  resolveCalcCurrencyRate,
  fetchExchangeRate,
  getOrFetchHistoricalRate,
} from "@/lib/exchange-rate";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

type EliteStatusShape = { eliteStatus: unknown };

type EnrichableBooking = {
  currency: string;
  lockedExchangeRate: unknown;
  checkIn: Date | string;
  loyaltyPointsEarned: number | null;
  pretaxCost: unknown;
  hotelChain: {
    basePointRate?: unknown;
    calculationCurrency?: string | null;
    // Pre-normalization (array from Prisma include)
    userStatuses?: EliteStatusShape[];
    // Post-normalization (normalizeUserStatuses converts array → singular)
    userStatus?: EliteStatusShape | null;
  } | null;
  hotelChainSubBrand?: { basePointRate?: unknown } | null;
};

/**
 * Resolves the exchange rate and dynamic loyalty points for a booking response.
 * - Past/USD bookings: uses the stored lockedExchangeRate.
 * - Future non-USD bookings: looks up the current cached rate and marks isFutureEstimate=true.
 * - Loyalty points: computed dynamically when not yet locked (future non-USD).
 * - calcCurrencyToUsdRate: enriched on hotelChain for use in cost breakdown formulas.
 */
export async function enrichBookingWithRate<T extends EnrichableBooking>(booking: T) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = booking.checkIn instanceof Date ? booking.checkIn : new Date(booking.checkIn);
  const isFuture = checkIn > today;
  const isNonUsd = booking.currency !== "USD";
  const isFutureEstimate = isFuture && isNonUsd;

  let resolvedRate: number | null = booking.lockedExchangeRate
    ? Number(booking.lockedExchangeRate)
    : null;
  if (resolvedRate == null && !isFutureEstimate) resolvedRate = 1;
  if (resolvedRate == null && isFutureEstimate) {
    resolvedRate = await getCurrentRate(booking.currency);
  }

  // Always resolve calcCurrencyToUsdRate so it's available for cost breakdown formulas
  const calcCurrency = booking.hotelChain?.calculationCurrency ?? "USD";
  const calcCurrencyToUsdRate = await resolveCalcCurrencyRate(calcCurrency);

  let loyaltyPointsEstimated = false;
  let loyaltyPointsEarned = booking.loyaltyPointsEarned;
  if (booking.hotelChain && booking.loyaltyPointsEarned == null && resolvedRate != null) {
    const basePointRate = resolveBasePointRate(booking.hotelChain, booking.hotelChainSubBrand);
    // Support both pre-normalization (userStatuses[]) and post-normalization (userStatus)
    const eliteStatusRaw =
      booking.hotelChain.userStatuses?.[0]?.eliteStatus ??
      booking.hotelChain.userStatus?.eliteStatus ??
      null;
    const eliteStatus = eliteStatusRaw as {
      isFixed: boolean;
      fixedRate: string | number | null;
      bonusPercentage: string | number | null;
    } | null;
    const usdPretax = Number(booking.pretaxCost) * resolvedRate;
    loyaltyPointsEarned = calculatePoints({
      pretaxCost: usdPretax,
      basePointRate,
      calculationCurrency: calcCurrency,
      calcCurrencyToUsdRate,
      eliteStatus: eliteStatus ?? null,
    });
    loyaltyPointsEstimated = true;
  }

  let exchangeRateEstimated = false;
  if (isNonUsd && !isFuture && resolvedRate != null) {
    const checkInDate = checkIn;
    const dayBefore = new Date(checkInDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const [historyOnDate, historyDayBefore] = await Promise.all([
      prisma.exchangeRateHistory.findUnique({
        where: {
          fromCurrency_toCurrency_date: {
            fromCurrency: booking.currency,
            toCurrency: "USD",
            date: checkInDate,
          },
        },
      }),
      prisma.exchangeRateHistory.findUnique({
        where: {
          fromCurrency_toCurrency_date: {
            fromCurrency: booking.currency,
            toCurrency: "USD",
            date: dayBefore,
          },
        },
      }),
    ]);

    exchangeRateEstimated = historyOnDate == null && historyDayBefore == null;
  }

  return {
    ...booking,
    lockedExchangeRate: resolvedRate,
    loyaltyPointsEarned,
    isFutureEstimate,
    loyaltyPointsEstimated,
    exchangeRateEstimated,
    hotelChain: booking.hotelChain
      ? {
          ...booking.hotelChain,
          calcCurrencyToUsdRate,
        }
      : null,
  };
}

/**
 * For all past-due bookings where checkIn <= today, lockedExchangeRate is null,
 * and currency != USD: locks the exchange rate, calculates loyalty points, and
 * locks lockedLoyaltyUsdCentsPerPoint. Optionally scoped to a single user (e.g.
 * during seeding). Returns the IDs of bookings that were successfully finalized.
 */
export async function finalizeCheckedInBookings(userId?: string): Promise<string[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastDueBookings = await prisma.booking.findMany({
    where: {
      ...(userId ? { userId } : {}),
      checkIn: { lte: today },
      lockedExchangeRate: null,
      NOT: { currency: "USD" },
    },
    include: {
      hotelChain: { include: { pointType: true } },
      hotelChainSubBrand: true,
    },
  });

  // Batch-fetch userStatuses for all bookings that will need loyalty point calculation
  const bookingsNeedingLoyalty = pastDueBookings.filter(
    (b) => b.loyaltyPointsEarned == null && b.hotelChain != null
  );
  const userStatusRows = await prisma.userStatus.findMany({
    where: {
      OR: bookingsNeedingLoyalty.map((b) => ({
        userId: b.userId,
        hotelChainId: b.hotelChain!.id,
      })),
    },
    include: { eliteStatus: true },
  });
  const userStatusMap = new Map(
    userStatusRows.map((us) => [`${us.userId}_${us.hotelChainId}`, us])
  );

  const finalizedIds: string[] = [];

  for (const booking of pastDueBookings) {
    try {
      const checkInStr = booking.checkIn.toISOString().split("T")[0];
      const rate = await getOrFetchHistoricalRate(booking.currency, checkInStr);
      if (rate == null) {
        logger.warn("No exchange rate available for booking, skipping finalization", {
          bookingId: booking.id,
          currency: booking.currency,
          checkIn: checkInStr,
        });
        continue;
      }

      let loyaltyPointsEarned = booking.loyaltyPointsEarned;
      if (loyaltyPointsEarned == null && booking.hotelChain) {
        const userStatus = userStatusMap.get(`${booking.userId}_${booking.hotelChain.id}`) ?? null;
        const basePointRate = resolveBasePointRate(booking.hotelChain, booking.hotelChainSubBrand);
        const usdPretaxCost = Number(booking.pretaxCost) * rate;
        loyaltyPointsEarned = calculatePoints({
          pretaxCost: usdPretaxCost,
          basePointRate,
          eliteStatus: userStatus?.eliteStatus ?? null,
        });
      }

      const pt = booking.hotelChain?.pointType;
      let lockedLoyaltyUsdCentsPerPoint: number | undefined;
      if (pt?.programCurrency != null && pt?.programCentsPerPoint != null) {
        const programRate = await fetchExchangeRate(pt.programCurrency, checkInStr);
        lockedLoyaltyUsdCentsPerPoint = Number(pt.programCentsPerPoint) * programRate;
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: { lockedExchangeRate: rate, loyaltyPointsEarned, lockedLoyaltyUsdCentsPerPoint },
      });
      finalizedIds.push(booking.id);
    } catch (err) {
      logger.error("Failed to finalize checked-in booking", err, {
        context: "FINALIZE_CHECKED_IN_BOOKING",
        bookingId: booking.id,
      });
    }
  }

  return finalizedIds;
}
