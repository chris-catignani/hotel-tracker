import prisma from "@/lib/prisma";
import { findOrCreateProperty } from "@/lib/property-utils";
import { resolveBookingFinancials } from "@/lib/booking-financials";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import { matchSubBrand } from "./email-parser";
import { logger } from "@/lib/logger";
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

  // Resolve hotel chain — prefer parsed chain from email content, fall back to caller-supplied name
  const resolvedChainName = parsed.hotelChain ?? chainName;
  const hotelChain = resolvedChainName
    ? await prisma.hotelChain.findFirst({
        where: { name: { contains: resolvedChainName, mode: "insensitive" } },
        include: { pointType: true },
      })
    : null;
  logger.info("ingest-booking: chain resolved", {
    parsed: parsed.hotelChain,
    resolved: hotelChain?.name ?? null,
  });

  // Resolve sub-brand — ask Claude to pick the best match from the DB list
  let subBrand = null;
  if (hotelChain && parsed.subBrand) {
    const allSubBrands = await prisma.hotelChainSubBrand.findMany({
      where: { hotelChainId: hotelChain.id },
    });
    const matchedName = await matchSubBrand(
      parsed.subBrand,
      allSubBrands.map((sb) => sb.name)
    );
    subBrand = allSubBrands.find((sb) => sb.name === matchedName) ?? null;
  }
  logger.info("ingest-booking: sub-brand resolved", {
    parsed: parsed.subBrand,
    resolved: subBrand?.name ?? null,
  });

  // Resolve OTA agency
  const otaAgency = parsed.otaAgencyName
    ? await prisma.otaAgency.findFirst({
        where: { name: { equals: parsed.otaAgencyName, mode: "insensitive" } },
      })
    : null;

  // Resolve property
  const propertyId = await findOrCreateProperty({
    propertyName: parsed.propertyName,
    hotelChainId: hotelChain?.id ?? null,
  });

  const pretaxCost =
    parsed.bookingType === "cash"
      ? parsed.nightlyRates
        ? Math.round(parsed.nightlyRates.reduce((sum, r) => sum + r.amount, 0) * 100) / 100
        : parsed.pretaxCost
      : null;

  const taxAmount =
    parsed.bookingType === "cash"
      ? parsed.nightlyRates && pretaxCost !== null && parsed.totalCost !== null
        ? Math.round((parsed.totalCost - pretaxCost) * 100) / 100
        : parsed.taxAmount
      : null;

  const financials = await resolveBookingFinancials({
    checkIn: parsed.checkIn,
    currency: parsed.currency ?? "USD",
    hotelChainId: hotelChain?.id ?? null,
    pretaxCost,
    userId,
  });

  const booking = await prisma.booking.create({
    data: {
      userId,
      hotelChainId: hotelChain?.id ?? null,
      hotelChainSubBrandId: subBrand?.id ?? null,
      accommodationType: parsed.accommodationType ?? "hotel",
      propertyId,
      checkIn: new Date(parsed.checkIn),
      checkOut: new Date(parsed.checkOut),
      numNights: parsed.numNights,
      pretaxCost: pretaxCost ?? 0,
      taxAmount: taxAmount ?? 0,
      totalCost: parsed.totalCost ?? 0,
      currency: parsed.currency ?? "USD",
      lockedExchangeRate: financials.lockedExchangeRate,
      pointsRedeemed: parsed.pointsRedeemed ?? null,
      loyaltyPointsEarned: financials.loyaltyPointsEarned,
      lockedLoyaltyUsdCentsPerPoint: financials.lockedLoyaltyUsdCentsPerPoint,
      confirmationNumber: parsed.confirmationNumber ?? null,
      bookingSource: otaAgency ? "ota" : null,
      otaAgencyId: otaAgency?.id ?? null,
      ingestionMethod: "email",
      needsReview: true,
      paymentTiming: "postpaid",
    },
  });

  await matchPromotionsForBooking(booking.id);

  return { bookingId: booking.id, duplicate: false };
}
