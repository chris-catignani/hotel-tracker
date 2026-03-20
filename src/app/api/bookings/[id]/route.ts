import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  matchPromotionsForBooking,
  reevaluateBookings,
  getConstrainedPromotions,
  fetchPromotionUsage,
  MatchingPromotion,
  MatchingBooking,
} from "@/lib/promotion-matching";
import { reevaluateSubsequentBookings } from "@/lib/promotion-matching-helpers";
import { apiError } from "@/lib/api-error";
import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import { fetchExchangeRate, getCurrentRate, resolveCalcCurrencyRate } from "@/lib/exchange-rate";
import { enrichBookingWithRate } from "@/lib/booking-enrichment";
import { findOrCreateProperty } from "@/lib/property-utils";
import {
  reapplyCardBenefitsAffectedByBooking,
  reapplyBenefitForPeriod,
} from "@/lib/card-benefit-apply";

async function getFullBookingWithUsage(id: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id, userId },
    include: {
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
              restrictions: {
                include: {
                  subBrandRestrictions: true,
                  tieInCards: true,
                },
              },
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
                  restrictions: {
                    include: {
                      subBrandRestrictions: true,
                      tieInCards: true,
                    },
                  },
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
    },
  });

  if (!booking) return null;

  // Enhance with usage statistics for better breakdown details
  const promotions = booking.bookingPromotions.map((bp) => ({
    ...bp.promotion,
    registrationDate: null, // fetchPromotionUsage will handle it if needed
  })) as unknown as MatchingPromotion[];
  const constrainedPromos = getConstrainedPromotions(promotions);
  const usageMap = await fetchPromotionUsage(
    constrainedPromos,
    booking as unknown as MatchingBooking,
    booking.id
  );

  const enhancedBookingPromotions = booking.bookingPromotions.map((bp) => {
    const usage = usageMap.get(bp.promotionId);
    if (!usage) return bp;

    return {
      ...bp,
      eligibleStayCount: (usage.eligibleStayCount ?? 0) + 1,
      eligibleNightCount: (usage.eligibleNightCount ?? 0) + booking.numNights,
      benefitApplications: bp.benefitApplications.map((ba) => {
        const bUsage = usage.benefitUsage?.get(ba.promotionBenefitId);
        return {
          ...ba,
          eligibleStayCount: (usage.eligibleStayCount ?? 0) + 1,
          eligibleNightCount: (bUsage?.eligibleNights ?? 0) + booking.numNights,
        };
      }),
    };
  });

  const result = {
    ...booking,
    bookingPromotions: enhancedBookingPromotions,
  };

  const normalized = normalizeUserStatuses(result) as typeof result;
  return enrichBookingWithRate(normalized);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const booking = await getFullBookingWithUsage(id, userId);

    if (!booking) {
      return apiError("Booking not found", null, 404, request);
    }

    return NextResponse.json(booking);
  } catch (error) {
    return apiError("Failed to fetch booking", error, 500, request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;

    const exists = await prisma.booking.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return apiError("Booking not found", null, 404, request);

    const body = await request.json();
    const {
      accommodationType,
      hotelChainId,
      propertyId,
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
    let resolvedPropertyId: string | undefined = propertyId;
    if (!resolvedPropertyId && propertyName) {
      const chainId =
        hotelChainId ??
        (await prisma.booking.findFirst({ where: { id, userId }, select: { hotelChainId: true } }))
          ?.hotelChainId;
      resolvedPropertyId = await findOrCreateProperty({
        propertyName,
        placeId,
        hotelChainId: chainId,
        countryCode,
        city,
        address,
        latitude,
        longitude,
      });
    }

    const data: Record<string, unknown> = {};
    if (accommodationType !== undefined) data.accommodationType = accommodationType;
    if (hotelChainId !== undefined) data.hotelChainId = hotelChainId || null;
    if (hotelChainSubBrandId !== undefined)
      data.hotelChainSubBrandId = hotelChainSubBrandId || null;
    if (resolvedPropertyId !== undefined) data.propertyId = resolvedPropertyId;
    if (checkIn !== undefined) data.checkIn = new Date(checkIn);
    if (checkOut !== undefined) data.checkOut = new Date(checkOut);
    if (numNights !== undefined) data.numNights = Number(numNights);
    if (pretaxCost !== undefined) data.pretaxCost = Number(pretaxCost);
    if (taxAmount !== undefined) data.taxAmount = Number(taxAmount);
    if (totalCost !== undefined) data.totalCost = Number(totalCost);
    if (userCreditCardId !== undefined) data.userCreditCardId = userCreditCardId || null;
    if (bookingDate !== undefined) data.bookingDate = bookingDate ? new Date(bookingDate) : null;
    if (paymentTiming !== undefined) data.paymentTiming = paymentTiming || "postpaid";
    if (shoppingPortalId !== undefined) data.shoppingPortalId = shoppingPortalId || null;
    if (portalCashbackRate !== undefined)
      data.portalCashbackRate = portalCashbackRate ? Number(portalCashbackRate) : null;
    if (loyaltyPointsEarned !== undefined)
      data.loyaltyPointsEarned = loyaltyPointsEarned ? Number(loyaltyPointsEarned) : null;
    if (portalCashbackOnTotal !== undefined) data.portalCashbackOnTotal = portalCashbackOnTotal;
    if (pointsRedeemed !== undefined)
      data.pointsRedeemed = pointsRedeemed ? Number(pointsRedeemed) : null;
    if (notes !== undefined) data.notes = notes || null;
    if (bookingSource !== undefined) {
      data.bookingSource = bookingSource || null;
      data.otaAgencyId = bookingSource === "ota" && otaAgencyId ? otaAgencyId : null;
    }

    // Resolve exchange rate when currency or checkIn changes
    if (currency !== undefined || checkIn !== undefined) {
      const current = await prisma.booking.findFirst({ where: { id, userId } });
      const finalCurrency = currency ?? current?.currency ?? "USD";
      const finalCheckIn = checkIn ? new Date(checkIn) : (current?.checkIn ?? new Date());
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPast = finalCheckIn <= today;

      if (finalCurrency === "USD") {
        data.currency = finalCurrency;
        data.exchangeRate = 1;
      } else if (isPast) {
        data.currency = finalCurrency;
        const checkInStr = finalCheckIn.toISOString().split("T")[0];
        data.exchangeRate = await fetchExchangeRate(finalCurrency, checkInStr);
      } else {
        data.currency = finalCurrency;
        data.exchangeRate = null;
      }
    } else if (currency !== undefined) {
      data.currency = currency;
    }

    // Auto-calculate loyalty points if not explicitly provided but hotel/pretax changed
    // Only for past/USD bookings (where exchange rate is locked)
    if (loyaltyPointsEarned === undefined || loyaltyPointsEarned === null) {
      const resolvedHotelChainId = hotelChainId;
      const resolvedPretax = pretaxCost !== undefined ? Number(pretaxCost) : undefined;

      if (resolvedHotelChainId || resolvedPretax) {
        // Fetch current booking to fill in missing values
        const current = await prisma.booking.findFirst({
          where: { id, userId },
        });
        const finalCurrency = (data.currency as string | undefined) ?? current?.currency ?? "USD";
        const finalCheckIn = checkIn ? new Date(checkIn) : (current?.checkIn ?? new Date());
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = finalCheckIn <= today;
        const shouldCompute = finalCurrency === "USD" || isPast;

        if (shouldCompute) {
          const finalHotelChainId = resolvedHotelChainId ?? current?.hotelChainId;
          const finalPretax = resolvedPretax ?? (current ? Number(current.pretaxCost) : null);
          const finalHotelChainSubBrandId =
            hotelChainSubBrandId !== undefined
              ? hotelChainSubBrandId || null
              : (current?.hotelChainSubBrandId ?? null);

          if (finalHotelChainId && finalPretax) {
            // Resolve exchange rate for USD calculation
            const resolvedRate = data.exchangeRate
              ? Number(data.exchangeRate)
              : current?.exchangeRate
                ? Number(current.exchangeRate)
                : finalCurrency === "USD"
                  ? 1
                  : ((await getCurrentRate(finalCurrency)) ?? 1);

            const [userStatus, hotelChain, subBrand] = await Promise.all([
              prisma.userStatus.findUnique({
                where: { userId_hotelChainId: { userId, hotelChainId: finalHotelChainId } },
                include: { eliteStatus: true },
              }),
              prisma.hotelChain.findUnique({ where: { id: finalHotelChainId } }),
              finalHotelChainSubBrandId
                ? prisma.hotelChainSubBrand.findUnique({ where: { id: finalHotelChainSubBrandId } })
                : null,
            ]);

            const basePointRate = resolveBasePointRate(hotelChain, subBrand);

            // Resolve calc currency rate if chain uses non-USD rates (e.g., EUR for Accor)
            const calcCurrency = hotelChain?.calculationCurrency ?? "USD";
            const calcCurrencyToUsdRate = await resolveCalcCurrencyRate(calcCurrency);

            const usdPretax = finalPretax * resolvedRate;
            data.loyaltyPointsEarned = calculatePoints({
              pretaxCost: usdPretax,
              basePointRate,
              calculationCurrency: calcCurrency,
              calcCurrencyToUsdRate,
              eliteStatus: userStatus?.eliteStatus
                ? {
                    bonusPercentage: userStatus.eliteStatus.bonusPercentage,
                    fixedRate: userStatus.eliteStatus.fixedRate,
                    isFixed: userStatus.eliteStatus.isFixed,
                  }
                : null,
            });
          }
        }
      }
    }

    // Handle certificates: delete old ones and recreate if provided
    if (certificates !== undefined) {
      await prisma.bookingCertificate.deleteMany({
        where: { bookingId: id },
      });
      if ((certificates as string[]).length > 0) {
        await prisma.bookingCertificate.createMany({
          data: (certificates as string[]).map((v) => ({
            bookingId: id,
            certType: v as import("@prisma/client").CertType,
          })),
        });
      }
    }

    // Handle benefits: delete old ones and recreate if provided
    if (benefits !== undefined) {
      await prisma.bookingBenefit.deleteMany({
        where: { bookingId: id },
      });
      const validBenefits = (
        benefits as { benefitType: string; label?: string; dollarValue?: number }[]
      ).filter((b) => b.benefitType);
      if (validBenefits.length > 0) {
        await prisma.bookingBenefit.createMany({
          data: validBenefits.map((b) => ({
            bookingId: id,
            benefitType: b.benefitType as import("@prisma/client").BenefitType,
            label: b.label || null,
            dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
          })),
        });
      }
    }

    // If geo fields are provided without a propertyName, update the existing property in place
    if (
      !resolvedPropertyId &&
      (countryCode !== undefined || city !== undefined || address !== undefined)
    ) {
      const current = await prisma.booking.findFirst({
        where: { id, userId },
        select: { propertyId: true },
      });
      if (current?.propertyId) {
        await prisma.property.update({
          where: { id: current.propertyId },
          data: {
            ...(countryCode !== undefined && { countryCode: countryCode || null }),
            ...(city !== undefined && { city: city || null }),
            ...(address !== undefined && { address: address || null }),
            ...(latitude !== undefined && { latitude: latitude ?? null }),
            ...(longitude !== undefined && { longitude: longitude ?? null }),
          },
        });
      }
    }

    // Capture existing card benefit pairs before update so we can re-evaluate
    // periods that may no longer match after the change (e.g. card switched)
    const oldCardBenefitPairs = await prisma.bookingCardBenefit.findMany({
      where: { bookingId: id },
      select: { cardBenefitId: true, periodKey: true },
    });

    const booking = await prisma.booking.update({
      where: { id },
      data,
    });

    // Re-run promotion matching after update
    const appliedPromoIds = await matchPromotionsForBooking(booking.id);

    // Re-evaluate subsequent bookings if this is an earlier stay
    await reevaluateSubsequentBookings(booking.id, appliedPromoIds);

    // Re-apply card benefits, including any periods affected before the change
    await reapplyCardBenefitsAffectedByBooking(
      booking.id,
      oldCardBenefitPairs.map((p) => ({ benefitId: p.cardBenefitId, periodKey: p.periodKey }))
    );

    // Fetch the booking with all relations to return
    const fullBooking = await getFullBookingWithUsage(booking.id, userId);

    return NextResponse.json(fullBooking);
  } catch (error) {
    return apiError("Failed to update booking", error, 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;

    // Find booking and its applied promotions before deleting (also verifies ownership)
    const booking = await prisma.booking.findFirst({
      where: { id, userId },
      select: {
        checkIn: true,
        bookingPromotions: { select: { promotionId: true } },
        bookingCardBenefits: { select: { cardBenefitId: true, periodKey: true } },
      },
    });

    if (!booking) {
      return apiError("Booking not found", null, 404, request);
    }

    // Capture promotion IDs and find affected subsequent bookings BEFORE deleting.
    const appliedPromoIds = booking.bookingPromotions.map((bp) => bp.promotionId);
    let subsequentBookingIds: string[] = [];
    if (appliedPromoIds.length > 0) {
      const affected = await prisma.booking.findMany({
        where: {
          checkIn: { gt: booking.checkIn },
          bookingPromotions: { some: { promotionId: { in: appliedPromoIds } } },
        },
        select: { id: true },
        orderBy: { checkIn: "asc" },
      });
      subsequentBookingIds = affected.map((b) => b.id);
    }

    // Capture card benefit pairs before deletion so we can re-evaluate after
    const cardBenefitPairs = booking.bookingCardBenefits.map((b) => ({
      benefitId: b.cardBenefitId,
      periodKey: b.periodKey,
    }));

    // Delete associated booking promotions first
    await prisma.bookingPromotion.deleteMany({
      where: { bookingId: id },
    });

    await prisma.booking.delete({
      where: { id },
    });

    // Re-evaluate subsequent bookings
    if (subsequentBookingIds.length > 0) {
      await reevaluateBookings(subsequentBookingIds);
    }

    // Re-evaluate card benefit periods freed by this deletion
    for (const { benefitId, periodKey } of cardBenefitPairs) {
      await reapplyBenefitForPeriod(benefitId, periodKey, userId);
    }

    return NextResponse.json({ message: "Booking deleted" });
  } catch (error) {
    return apiError("Failed to delete booking", error, 500, request);
  }
}
