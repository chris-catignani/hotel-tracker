import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import { reevaluateSubsequentBookings } from "@/lib/promotion-matching-helpers";
import { apiError } from "@/lib/api-error";
import { calculatePoints } from "@/lib/loyalty-utils";
import { CertType, BenefitType } from "@prisma/client";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import { fetchExchangeRate, getCurrentRate } from "@/lib/exchange-rate";
import { enrichBookingWithRate } from "@/lib/booking-enrichment";

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
    creditCard: { include: { pointType: true, rewardRules: true } },
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

    return NextResponse.json(enriched);
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
      hotelChainId,
      propertyName,
      checkIn,
      checkOut,
      numNights,
      pretaxCost,
      taxAmount,
      totalCost,
      creditCardId,
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
      countryCode,
      city,
    } = body;

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
      resolvedExchangeRate = await fetchExchangeRate(resolvedCurrency, checkInStr);
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
      // Fetch UserStatus for this chain
      const userStatus = await prisma.userStatus.findUnique({
        where: { userId_hotelChainId: { userId, hotelChainId } },
        include: { eliteStatus: true },
      });

      let basePointRate: number | null = null;
      if (hotelChainSubBrandId) {
        const subBrand = await prisma.hotelChainSubBrand.findUnique({
          where: { id: hotelChainSubBrandId },
        });
        if (subBrand?.basePointRate != null) {
          basePointRate = Number(subBrand.basePointRate);
        }
      }
      if (basePointRate == null) {
        const hotelChain = await prisma.hotelChain.findUnique({
          where: { id: hotelChainId },
        });
        if (hotelChain?.basePointRate != null) {
          basePointRate = Number(hotelChain.basePointRate);
        }
      }

      const usdPretaxCost = Number(pretaxCost) * rateForLoyalty;
      calculatedPoints = calculatePoints({
        pretaxCost: usdPretaxCost,
        basePointRate,
        eliteStatus: userStatus?.eliteStatus
          ? {
              bonusPercentage: userStatus.eliteStatus.bonusPercentage,
              fixedRate: userStatus.eliteStatus.fixedRate,
              isFixed: userStatus.eliteStatus.isFixed,
            }
          : null,
      });
    }

    const booking = await prisma.booking.create({
      data: {
        userId,
        hotelChainId: hotelChainId,
        hotelChainSubBrandId: hotelChainSubBrandId || null,
        propertyName,
        checkIn: checkInDate,
        checkOut: new Date(checkOut),
        numNights: Number(numNights),
        pretaxCost: Number(pretaxCost),
        taxAmount: Number(taxAmount),
        totalCost: Number(totalCost),
        creditCardId: creditCardId || null,
        shoppingPortalId: shoppingPortalId || null,
        portalCashbackRate: portalCashbackRate ? Number(portalCashbackRate) : null,
        portalCashbackOnTotal: portalCashbackOnTotal ?? false,
        loyaltyPointsEarned: calculatedPoints,
        pointsRedeemed: pointsRedeemed ? Number(pointsRedeemed) : null,
        currency: resolvedCurrency,
        exchangeRate: resolvedExchangeRate,
        countryCode: countryCode || null,
        city: city || null,
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
              create: (benefits as { benefitType: string; label?: string; dollarValue?: number }[])
                .filter((b) => b.benefitType)
                .map((b) => ({
                  benefitType: b.benefitType as BenefitType,
                  label: b.label || null,
                  dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
                })),
            }
          : undefined,
      },
    });

    // Auto-run promotion matching
    const appliedPromoIds = await matchPromotionsForBooking(booking.id);

    // Re-evaluate subsequent bookings if this is an earlier stay
    await reevaluateSubsequentBookings(booking.id, appliedPromoIds);

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
