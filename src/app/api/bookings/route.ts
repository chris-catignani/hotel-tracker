import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import { reevaluateSubsequentBookings } from "@/lib/promotion-matching-helpers";
import { apiError } from "@/lib/api-error";
import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import { CertType, BenefitType, BenefitPointsEarnType, AccommodationType } from "@prisma/client";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import {
  fetchExchangeRate,
  getOrFetchHistoricalRate,
  getCurrentRate,
  resolveCalcCurrencyRate,
} from "@/lib/exchange-rate";
import { enrichBookingWithRate } from "@/lib/booking-enrichment";
import { findOrCreateProperty } from "@/lib/property-utils";
import { reapplyCardBenefitsAffectedByBooking } from "@/lib/card-benefit-apply";
import { resolvePartnershipEarns } from "@/lib/partnership-earns";
import { validateBenefits } from "@/lib/booking-benefit-validation";

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
  }) as const;

export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const bookings = await prisma.booking.findMany({
      where: { userId },
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
}

export async function POST(request: NextRequest) {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = checkInDate <= today;

    // Resolve exchange rate: 1 for USD; historical rate for past non-USD; null for future non-USD
    let resolvedExchangeRate: number | null = null;
    if (resolvedCurrency === "USD") {
      resolvedExchangeRate = 1;
    } else if (isPast) {
      const checkInStr = checkInDate.toISOString().split("T")[0];
      resolvedExchangeRate = await getOrFetchHistoricalRate(resolvedCurrency, checkInStr);
    }
    // future non-USD: resolvedExchangeRate stays null

    // For loyalty points, use resolved or current rate to compute USD pretax cost
    const rateForLoyalty = resolvedExchangeRate ?? (await getCurrentRate(resolvedCurrency)) ?? 1;

    // Auto-calculate loyalty points from hotel/sub-brand rates if not explicitly provided
    // Only compute and store loyalty points when exchange rate is locked (past/USD bookings)
    let calculatedPoints: number | null =
      loyaltyPointsEarned != null ? Number(loyaltyPointsEarned) : null;

    const shouldComputeLoyalty = resolvedExchangeRate != null; // only for past/USD
    if (calculatedPoints == null && shouldComputeLoyalty && hotelChainId && pretaxCost) {
      // Fetch UserStatus and hotel chain in parallel
      const [userStatus, hotelChain, subBrand] = await Promise.all([
        prisma.userStatus.findUnique({
          where: { userId_hotelChainId: { userId, hotelChainId } },
          include: { eliteStatus: true },
        }),
        prisma.hotelChain.findUnique({ where: { id: hotelChainId } }),
        hotelChainSubBrandId
          ? prisma.hotelChainSubBrand.findUnique({ where: { id: hotelChainSubBrandId } })
          : null,
      ]);

      const basePointRate = resolveBasePointRate(hotelChain, subBrand);

      // Resolve calc currency rate if chain uses non-USD rates (e.g., EUR for Accor)
      const calcCurrency = hotelChain?.calculationCurrency ?? "USD";
      const calcCurrencyToUsdRate = await resolveCalcCurrencyRate(calcCurrency);

      const usdPretaxCost = Number(pretaxCost) * rateForLoyalty;
      calculatedPoints = calculatePoints({
        pretaxCost: usdPretaxCost,
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

    // Lock the loyalty point USD rate at check-in for foreign-currency point types (e.g. Accor/EUR).
    // Uses the program currency rate (not the booking currency rate) since programCentsPerPoint
    // is denominated in programCurrency regardless of what the guest paid in.
    let lockedLoyaltyUsdCentsPerPoint: number | null = null;
    if (isPast && hotelChainId) {
      const hcWithPt = await prisma.hotelChain.findUnique({
        where: { id: hotelChainId },
        select: { pointType: { select: { programCurrency: true, programCentsPerPoint: true } } },
      });
      const pt = hcWithPt?.pointType;
      if (pt?.programCurrency != null && pt?.programCentsPerPoint != null) {
        const checkInStr = checkInDate.toISOString().split("T")[0];
        const programRate = await fetchExchangeRate(pt.programCurrency, checkInStr);
        lockedLoyaltyUsdCentsPerPoint = Number(pt.programCentsPerPoint) * programRate;
      }
    }

    const benefitValidationError = await validateBenefits(benefits ?? [], hotelChainId);
    if (benefitValidationError) {
      return apiError(benefitValidationError, null, 400, request);
    }

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
      },
    });

    // Auto-run promotion matching
    const appliedPromoIds = await matchPromotionsForBooking(booking.id);

    // Re-evaluate subsequent bookings if this is an earlier stay
    await reevaluateSubsequentBookings(booking.id, appliedPromoIds);

    // Apply card benefits (re-evaluates all bookings in affected periods)
    await reapplyCardBenefitsAffectedByBooking(booking.id);

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
}
