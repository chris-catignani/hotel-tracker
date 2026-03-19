import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import { getCurrentRate, resolveCalcCurrencyRate } from "@/lib/exchange-rate";

type EliteStatusShape = { eliteStatus: unknown };

type EnrichableBooking = {
  currency: string;
  exchangeRate: unknown;
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
 * - Past/USD bookings: uses the stored exchangeRate.
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

  let resolvedRate: number | null = booking.exchangeRate ? Number(booking.exchangeRate) : null;
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

  return {
    ...booking,
    exchangeRate: resolvedRate,
    loyaltyPointsEarned,
    isFutureEstimate,
    loyaltyPointsEstimated,
    hotelChain: booking.hotelChain
      ? {
          ...booking.hotelChain,
          calcCurrencyToUsdRate,
        }
      : null,
  };
}
