import prisma from "@/lib/prisma";
import { findOrCreateProperty } from "@/lib/property-utils";
import { resolveBookingFinancials } from "@/lib/booking-financials";
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

  const financials = await resolveBookingFinancials({
    checkIn: parsed.checkIn,
    currency: parsed.currency ?? "USD",
    hotelChainId: hotelChain?.id ?? null,
    pretaxCost: parsed.bookingType === "cash" ? parsed.pretaxCost : null,
    userId,
  });

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
      currency: parsed.currency ?? "USD",
      lockedExchangeRate: financials.lockedExchangeRate,
      pointsRedeemed: parsed.pointsRedeemed ?? null,
      loyaltyPointsEarned: financials.loyaltyPointsEarned,
      lockedLoyaltyUsdCentsPerPoint: financials.lockedLoyaltyUsdCentsPerPoint,
      confirmationNumber: parsed.confirmationNumber ?? null,
      ingestionMethod: "email",
      needsReview: true,
      paymentTiming: "postpaid",
    },
  });

  await matchPromotionsForBooking(booking.id);

  return { bookingId: booking.id, duplicate: false };
}
