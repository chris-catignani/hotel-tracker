import { NextRequest, NextResponse } from "next/server";
import { withObservability as withAxiom } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { runPostBookingCreate } from "@/lib/booking-service";
import { apiError } from "@/lib/api-error";
import { resolveBookingFinancials } from "@/lib/booking-financials";
import {
  CertType,
  BenefitType,
  BenefitPointsEarnType,
  AccommodationType,
  IngestionMethod,
} from "@prisma/client";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import { enrichBookingWithRate } from "@/lib/booking-enrichment";
import { findOrCreateProperty } from "@/lib/property-utils";
import { resolvePartnershipEarns } from "@/lib/partnership-earns";
import { validateBenefits } from "@/lib/booking-benefit-validation";

function derivePostingStatuses(data: {
  loyaltyPointsEarned: number | null | undefined;
  accommodationType: string;
  hotelChainId: string | null | undefined;
  userCreditCardId: string | null | undefined;
  shoppingPortalId: string | null | undefined;
}) {
  return {
    loyaltyPostingStatus:
      data.loyaltyPointsEarned != null &&
      data.loyaltyPointsEarned > 0 &&
      data.accommodationType !== "apartment" &&
      data.hotelChainId != null
        ? ("pending" as const)
        : null,
    cardRewardPostingStatus: data.userCreditCardId != null ? ("pending" as const) : null,
    portalCashbackPostingStatus: data.shoppingPortalId != null ? ("pending" as const) : null,
  };
}

const BOOKING_INCLUDE = (userId: string) =>
  ({
    hotelChain: {
      include: {
        pointType: true,
        userStatuses: {
          where: { userId },
          include: { eliteStatus: true },
          take: 1,
        },
      },
    },
    hotelChainSubBrand: true,
    userCreditCard: {
      include: { creditCard: { include: { pointType: true, rewardRules: true } } },
    },
    shoppingPortal: { include: { pointType: true } },
    bookingPromotions: {
      include: {
        promotion: {
          include: {
            restrictions: true,
            benefits: { orderBy: { sortOrder: "asc" } },
            tiers: {
              include: {
                benefits: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        benefitApplications: {
          include: {
            promotionBenefit: {
              include: {
                restrictions: true,
              },
            },
          },
        },
      },
    },
    certificates: true,
    otaAgency: true,
    benefits: true,
    property: true,
    priceWatchBooking: { include: { priceWatch: { select: { isEnabled: true } } } },
    bookingCardBenefits: { include: { cardBenefit: true } },
    bookingPartnershipEarnStatuses: true,
  }) as const;

export const GET = withAxiom(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter");

    const whereClause =
      filter === "needs-attention"
        ? {
            userId,
            OR: [
              {
                checkIn: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                OR: [
                  { loyaltyPostingStatus: { not: null } },
                  { cardRewardPostingStatus: { not: null } },
                  { portalCashbackPostingStatus: { not: null } },
                  { bookingPromotions: { some: {} } },
                  { bookingCardBenefits: { some: {} } },
                  { benefits: { some: {} } },
                  { bookingPartnershipEarnStatuses: { some: {} } },
                ],
              },
              { loyaltyPostingStatus: "pending" as const },
              { cardRewardPostingStatus: "pending" as const },
              { portalCashbackPostingStatus: "pending" as const },
              { bookingPromotions: { some: { postingStatus: "pending" as const } } },
              { bookingCardBenefits: { some: { postingStatus: "pending" as const } } },
              { benefits: { some: { postingStatus: "pending" as const } } },
              {
                bookingPartnershipEarnStatuses: { some: { postingStatus: "pending" as const } },
              },
            ],
          }
        : { userId };

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: BOOKING_INCLUDE(userId),
      orderBy: {
        checkIn: "asc",
      },
    });

    const normalized = normalizeUserStatuses(bookings) as (typeof bookings)[number][];
    const enriched = await Promise.all(normalized.map(enrichBookingWithRate));

    // Fetch enabled partnership earns for this user once, then apply to each booking
    const enabledEarns = await prisma.userPartnershipEarn.findMany({
      where: { userId, isEnabled: true },
      include: { partnershipEarn: { include: { pointType: true } } },
    });

    const withPartnerships = await Promise.all(
      enriched.map(async (b) => {
        const partnershipEarns = await resolvePartnershipEarns(
          {
            hotelChainId: b.hotelChainId,
            pretaxCost: Number(b.pretaxCost),
            lockedExchangeRate: b.lockedExchangeRate ? Number(b.lockedExchangeRate) : null,
            property: b.property,
            checkIn: b.checkIn,
          },
          enabledEarns.map((e) => ({
            ...e.partnershipEarn,
            earnRate: Number(e.partnershipEarn.earnRate),
            pointType: {
              ...e.partnershipEarn.pointType,
              usdCentsPerPoint: Number(e.partnershipEarn.pointType.usdCentsPerPoint),
            },
          }))
        );
        return { ...b, partnershipEarns };
      })
    );

    return NextResponse.json(withPartnerships);
  } catch (error) {
    return apiError("Failed to fetch bookings", error, 500, request);
  }
});

export const POST = withAxiom(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const body = await request.json();
    const {
      accommodationType,
      hotelChainId,
      propertyId: bodyPropertyId,
      propertyName,
      placeId,
      countryCode,
      city,
      address,
      latitude,
      longitude,
      checkIn,
      checkOut,
      numNights,
      pretaxCost,
      taxAmount,
      totalCost,
      userCreditCardId,
      bookingDate,
      paymentTiming,
      shoppingPortalId,
      portalCashbackRate,
      portalCashbackOnTotal,
      loyaltyPointsEarned,
      pointsRedeemed,
      currency,
      certificates,
      bookingSource,
      otaAgencyId,
      benefits,
      notes,
      hotelChainSubBrandId,
      confirmationNumber,
      needsReview,
      ingestionMethod,
    } = body;

    // Resolve propertyId: use provided id, or find/create from geo fields
    let propertyId: string = bodyPropertyId;
    if (!propertyId && propertyName) {
      propertyId = await findOrCreateProperty({
        propertyName,
        placeId,
        hotelChainId,
        countryCode,
        city,
        address,
        latitude,
        longitude,
      });
    }

    const resolvedCurrency: string = currency || "USD";
    const checkInDate = new Date(checkIn);

    const userProvidedPoints =
      loyaltyPointsEarned != null ? Number(loyaltyPointsEarned) : undefined;

    const financials = await resolveBookingFinancials({
      checkIn: checkIn,
      currency: resolvedCurrency,
      hotelChainId: hotelChainId || null,
      hotelChainSubBrandId: hotelChainSubBrandId || null,
      // Pass pretaxCost for loyalty calculation only when user hasn't provided a value
      pretaxCost: userProvidedPoints == null && pretaxCost ? Number(pretaxCost) : null,
      userId,
    });

    const resolvedExchangeRate = financials.lockedExchangeRate;
    const calculatedPoints = userProvidedPoints ?? financials.loyaltyPointsEarned;
    const lockedLoyaltyUsdCentsPerPoint = financials.lockedLoyaltyUsdCentsPerPoint;

    const benefitValidationError = await validateBenefits(benefits ?? [], hotelChainId);
    if (benefitValidationError) {
      return apiError(benefitValidationError, null, 400, request);
    }

    const postingStatuses = derivePostingStatuses({
      loyaltyPointsEarned: calculatedPoints,
      accommodationType: accommodationType ?? "hotel",
      hotelChainId: hotelChainId || null,
      userCreditCardId: userCreditCardId || null,
      shoppingPortalId: shoppingPortalId || null,
    });

    const booking = await prisma.booking.create({
      data: {
        userId,
        accommodationType: (accommodationType ?? "hotel") as AccommodationType,
        hotelChainId: hotelChainId || null,
        hotelChainSubBrandId: hotelChainSubBrandId || null,
        propertyId,
        checkIn: checkInDate,
        checkOut: new Date(checkOut),
        numNights: Number(numNights),
        pretaxCost: Number(pretaxCost),
        taxAmount: Number(taxAmount),
        totalCost: Number(totalCost),
        userCreditCardId: userCreditCardId || null,
        bookingDate: bookingDate ? new Date(bookingDate) : null,
        paymentTiming: paymentTiming || "postpaid",
        shoppingPortalId: shoppingPortalId || null,
        portalCashbackRate: portalCashbackRate ? Number(portalCashbackRate) : null,
        portalCashbackOnTotal: portalCashbackOnTotal ?? false,
        loyaltyPointsEarned: calculatedPoints,
        pointsRedeemed: pointsRedeemed ? Number(pointsRedeemed) : null,
        currency: resolvedCurrency,
        lockedExchangeRate: resolvedExchangeRate,
        lockedLoyaltyUsdCentsPerPoint,
        notes: notes || null,
        confirmationNumber: confirmationNumber ?? null,
        needsReview: needsReview ?? false,
        ingestionMethod: (ingestionMethod ?? "manual") as IngestionMethod,
        bookingSource: bookingSource || null,
        otaAgencyId: bookingSource === "ota" && otaAgencyId ? otaAgencyId : null,
        certificates: certificates?.length
          ? {
              create: (certificates as string[]).map((v) => ({
                certType: v as CertType,
              })),
            }
          : undefined,
        benefits: benefits?.length
          ? {
              create: (
                benefits as {
                  benefitType: string;
                  label?: string;
                  dollarValue?: number | null;
                  pointsEarnType?: string | null;
                  pointsAmount?: number | null;
                  pointsMultiplier?: number | null;
                }[]
              )
                .filter((b) => b.benefitType)
                .map((b) => ({
                  benefitType: b.benefitType as BenefitType,
                  label: b.label || null,
                  dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
                  pointsEarnType: (b.pointsEarnType as BenefitPointsEarnType) || null,
                  pointsAmount: b.pointsAmount != null ? Number(b.pointsAmount) : null,
                  pointsMultiplier: b.pointsMultiplier != null ? Number(b.pointsMultiplier) : null,
                })),
            }
          : undefined,
        ...postingStatuses,
      },
    });

    await runPostBookingCreate(booking.id, {
      userId,
      accommodationType: (accommodationType ?? "hotel") as string,
      checkIn,
      checkOut,
      numNights: Number(numNights),
      totalCost: Number(totalCost),
      currency: resolvedCurrency,
      ingestionMethod: (ingestionMethod ?? "manual") as string,
    });

    // Fetch the booking with all relations to return
    const fullBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: BOOKING_INCLUDE(userId),
    });

    const normalizedBooking = normalizeUserStatuses(fullBooking) as typeof fullBooking;
    const enrichedBooking = normalizedBooking
      ? await enrichBookingWithRate(normalizedBooking)
      : null;

    return NextResponse.json(enrichedBooking, { status: 201 });
  } catch (error) {
    return apiError("Failed to create booking", error, 500, request);
  }
});
