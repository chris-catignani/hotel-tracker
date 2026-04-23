import prisma from "@/lib/prisma";
import { findOrCreateProperty } from "@/services/property-utils";
import { searchPlaces } from "@/services/geo-lookup";
import { resolveBookingFinancials } from "@/services/booking-financials";
import { runPostBookingCreate } from "@/services/booking.service";
import { matchSubBrand } from "@/services/email-ingestion/email-parser";
import { logger } from "@/lib/logger";
import type { ParsedBookingData } from "@/services/email-ingestion/types";

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

  // Geo-enrich the property via Google Places, mirroring the manual booking flow.
  // Apartments: always geocode by address (listing names don't exist in Google Places).
  // Hotels: geocode by property name with lodging type filter.
  const isHotel = (parsed.accommodationType ?? "hotel") !== "apartment";
  const geoQuery = isHotel ? parsed.propertyName : (parsed.propertyAddress ?? parsed.propertyName);
  const geoResults = await searchPlaces(geoQuery, isHotel);
  const geo = geoResults[0] ?? null;

  // Resolve property
  const propertyId = await findOrCreateProperty({
    propertyName: geo?.displayName ?? parsed.propertyName,
    placeId: geo?.placeId ?? null,
    hotelChainId: hotelChain?.id ?? null,
    countryCode: geo?.countryCode ?? null,
    city: geo?.city ?? null,
    address: geo?.address ?? null,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
  });

  const parsedTaxAmount = parsed.taxLines
    ? Math.round(parsed.taxLines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100
    : null;

  let pretaxCost: number | null;
  let taxAmount: number | null;

  if (parsed.bookingType === "cash") {
    if (parsed.discounts && parsed.totalCost !== null) {
      // Discount-aware path: compute net tax and derive pretaxCost via Method B (totalCost - netTax)
      const feeDiscountsTotal =
        Math.round(
          parsed.discounts.filter((d) => d.type === "fee").reduce((sum, d) => sum + d.amount, 0) *
            100
        ) / 100;
      const accommodationDiscountsTotal =
        Math.round(
          parsed.discounts
            .filter((d) => d.type === "accommodation")
            .reduce((sum, d) => sum + d.amount, 0) * 100
        ) / 100;
      taxAmount = Math.round(((parsedTaxAmount ?? 0) - feeDiscountsTotal) * 100) / 100;
      pretaxCost = Math.round((parsed.totalCost - taxAmount) * 100) / 100;
      if (parsed.nightlyRates) {
        // Cross-check: nightly rates minus accommodation discounts should agree with totalCost minus net tax
        const nightlyTotal =
          Math.round(parsed.nightlyRates.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
        const pretaxCostA = Math.round((nightlyTotal - accommodationDiscountsTotal) * 100) / 100;
        if (Math.abs(pretaxCostA - pretaxCost) > 0.1) {
          logger.warn("ingest-booking: pretaxCost mismatch", {
            fromNightlyRates: pretaxCostA,
            fromTotalCost: pretaxCost,
          });
        }
      }
    } else if (parsed.nightlyRates) {
      // Nightly rates provided — sum them for pretaxCost, derive taxAmount
      pretaxCost =
        Math.round(parsed.nightlyRates.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
      taxAmount =
        parsed.totalCost !== null
          ? Math.round((parsed.totalCost - pretaxCost) * 100) / 100
          : parsedTaxAmount;
    } else if (parsed.pretaxCost !== null) {
      // pretaxCost shown directly (most hotel emails)
      pretaxCost = parsed.pretaxCost;
      taxAmount = parsedTaxAmount;
    } else if (parsed.totalCost !== null && parsedTaxAmount !== null) {
      // pretaxCost null (e.g. Airbnb with discount line items) — derive from totalCost - taxAmount
      taxAmount = parsedTaxAmount;
      pretaxCost = Math.round((parsed.totalCost - taxAmount) * 100) / 100;
    } else {
      pretaxCost = null;
      taxAmount = null;
    }
  } else {
    pretaxCost = null;
    taxAmount = null;
  }

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

  await runPostBookingCreate(booking.id, {
    userId,
    accommodationType: parsed.accommodationType ?? "hotel",
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
    numNights: parsed.numNights,
    totalCost: parsed.totalCost ?? 0,
    currency: parsed.currency ?? "USD",
    ingestionMethod: "email",
  });

  return { bookingId: booking.id, duplicate: false };
}
