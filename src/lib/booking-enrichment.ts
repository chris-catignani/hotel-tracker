import { calculatePoints } from "@/lib/loyalty-utils";
import { getCurrentRate } from "@/lib/exchange-rate";

type EnrichableBooking = {
  currency: string;
  exchangeRate: unknown;
  checkIn: Date | string;
  loyaltyPointsEarned: number | null;
  pretaxCost: unknown;
  hotelChain: {
    basePointRate?: unknown;
    userStatuses?: { eliteStatus: unknown }[];
  };
  hotelChainSubBrand?: { basePointRate?: unknown } | null;
};

/**
 * Resolves the exchange rate and dynamic loyalty points for a booking response.
 * - Past/USD bookings: uses the stored exchangeRate.
 * - Future non-USD bookings: looks up the current cached rate and marks isFutureEstimate=true.
 * - Loyalty points: computed dynamically when not yet locked (future non-USD).
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

  let loyaltyPointsEstimated = false;
  let loyaltyPointsEarned = booking.loyaltyPointsEarned;
  if (booking.loyaltyPointsEarned == null && resolvedRate != null) {
    const basePointRate =
      booking.hotelChainSubBrand?.basePointRate != null
        ? Number(booking.hotelChainSubBrand.basePointRate)
        : booking.hotelChain.basePointRate != null
          ? Number(booking.hotelChain.basePointRate)
          : null;
    const eliteStatus = (booking.hotelChain.userStatuses?.[0]?.eliteStatus ?? null) as {
      isFixed: boolean;
      fixedRate: string | number | null;
      bonusPercentage: string | number | null;
    } | null;
    const usdPretax = Number(booking.pretaxCost) * resolvedRate;
    loyaltyPointsEarned = calculatePoints({
      pretaxCost: usdPretax,
      basePointRate,
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
  };
}
