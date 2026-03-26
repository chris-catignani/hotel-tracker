import prisma from "@/lib/prisma";
import { findOrCreateProperty } from "@/lib/property-utils";
import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import { getOrFetchHistoricalRate, getCurrentRate } from "@/lib/exchange-rate";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import type { ParsedBookingData } from "./types";

export interface IngestResult {
  bookingId: string;
  duplicate: boolean;
}

/**
 * Create a Booking from parsed email data.
 * Returns { bookingId, duplicate: true } if a booking with the same
 * (userId, confirmationNumber) already exists — no new record is created.
 */
export async function ingestBookingFromEmail(
  parsed: ParsedBookingData,
  userId: string,
  chainName: string | null
): Promise<IngestResult> {
  // Duplicate check
  if (parsed.confirmationNumber) {
    const existing = await prisma.booking.findFirst({
      where: {
        userId,
        confirmationNumber: parsed.confirmationNumber,
        checkIn: new Date(parsed.checkIn),
        checkOut: new Date(parsed.checkOut),
        totalCost: parsed.totalCost ?? 0,
        pointsRedeemed: parsed.pointsRedeemed ?? null,
      },
    });
    if (existing) return { bookingId: existing.id, duplicate: true };
  }

  // Resolve hotel chain
  const hotelChain = chainName
    ? await prisma.hotelChain.findFirst({
        where: { name: { contains: chainName, mode: "insensitive" } },
        include: { pointType: true },
      })
    : null;

  // Resolve property
  const propertyId = await findOrCreateProperty({
    propertyName: parsed.propertyName,
    hotelChainId: hotelChain?.id ?? null,
  });

  // Lock exchange rate
  const currency = parsed.currency ?? "USD";
  const today = new Date().toISOString().split("T")[0];
  const isPastCheckIn = parsed.checkIn <= today;
  let lockedExchangeRate: number | null = null;
  if (currency === "USD") {
    lockedExchangeRate = 1;
  } else if (isPastCheckIn) {
    lockedExchangeRate = await getOrFetchHistoricalRate(currency, parsed.checkIn);
  }
  // Future non-USD stays: lockedExchangeRate remains null

  // Calculate loyalty points
  let loyaltyPointsEarned: number | null = null;
  if (hotelChain && parsed.bookingType === "cash" && parsed.pretaxCost !== null) {
    const userStatus = await prisma.userStatus.findFirst({
      where: { userId, hotelChainId: hotelChain.id },
      include: { eliteStatus: true },
    });
    const basePointRate = resolveBasePointRate(hotelChain, null);
    const calcCurrency = hotelChain.calculationCurrency ?? "USD";
    const calcCurrencyToUsdRate = calcCurrency === "USD" ? 1 : await getCurrentRate(calcCurrency);
    loyaltyPointsEarned = calculatePoints({
      pretaxCost: parsed.pretaxCost,
      basePointRate,
      calculationCurrency: calcCurrency,
      calcCurrencyToUsdRate,
      eliteStatus: userStatus?.eliteStatus
        ? {
            bonusPercentage: userStatus.eliteStatus.bonusPercentage,
            fixedRate: userStatus.eliteStatus.fixedRate,
            isFixed: userStatus.eliteStatus.isFixed,
            pointsFloorTo: userStatus.eliteStatus.pointsFloorTo,
          }
        : null,
    });
  }

  const booking = await prisma.booking.create({
    data: {
      userId,
      hotelChainId: hotelChain?.id ?? null,
      accommodationType: "hotel",
      propertyId,
      checkIn: new Date(parsed.checkIn),
      checkOut: new Date(parsed.checkOut),
      numNights: parsed.numNights,
      pretaxCost: parsed.pretaxCost ?? 0,
      taxAmount: parsed.taxAmount ?? 0,
      totalCost: parsed.totalCost ?? 0,
      currency,
      lockedExchangeRate,
      pointsRedeemed: parsed.pointsRedeemed ?? null,
      loyaltyPointsEarned,
      confirmationNumber: parsed.confirmationNumber ?? null,
      ingestionMethod: "email",
      needsReview: true,
      paymentTiming: "postpaid",
    },
  });

  await matchPromotionsForBooking(booking.id);

  return { bookingId: booking.id, duplicate: false };
}
