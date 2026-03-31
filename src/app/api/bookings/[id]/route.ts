import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
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
import { CertType, BenefitType, BenefitPointsEarnType, PostingStatus } from "@prisma/client";
import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import {
  fetchExchangeRate,
  getOrFetchHistoricalRate,
  getCurrentRate,
  resolveCalcCurrencyRate,
} from "@/lib/exchange-rate";
import { enrichBookingWithPartnerships } from "@/lib/booking-enrichment";
import { findOrCreateProperty } from "@/lib/property-utils";
import {
  reapplyCardBenefitsAffectedByBooking,
  reapplyBenefitForPeriod,
} from "@/lib/card-benefit-apply";
import { validateBenefits } from "@/lib/booking-benefit-validation";

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
      bookingPartnershipEarnStatuses: true,
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

  return enrichBookingWithPartnerships(result, userId);
}

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const booking = await getFullBookingWithUsage(id, userId);

      if (!booking) {
        return apiError("Booking not found", null, 404, request, { bookingId: id });
      }

      return NextResponse.json(booking);
    } catch (error) {
      return apiError("Failed to fetch booking", error, 500, request, { bookingId: id });
    }
  }
);

export const PUT = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const current = await prisma.booking.findFirst({
        where: { id, userId },
        select: {
          id: true,
          currency: true,
          checkIn: true,
          hotelChainId: true,
          pretaxCost: true,
          hotelChainSubBrandId: true,
          lockedExchangeRate: true,
          propertyId: true,
          loyaltyPointsEarned: true,
          accommodationType: true,
          userCreditCardId: true,
          shoppingPortalId: true,
          loyaltyPostingStatus: true,
          cardRewardPostingStatus: true,
          portalCashbackPostingStatus: true,
        },
      });
      if (!current) return apiError("Booking not found", null, 404, request, { bookingId: id });

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
        confirmationNumber,
      } = body;

      // Resolve propertyId: use provided id, or find/create from geo fields
      let resolvedPropertyId: string | undefined = propertyId;
      if (!resolvedPropertyId && propertyName) {
        const chainId = hotelChainId ?? current.hotelChainId;
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
      if (confirmationNumber !== undefined) data.confirmationNumber = confirmationNumber ?? null;
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
        const finalCurrency = currency ?? current.currency ?? "USD";
        const finalCheckIn = checkIn ? new Date(checkIn) : (current.checkIn ?? new Date());
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = finalCheckIn <= today;

        if (finalCurrency === "USD") {
          data.currency = finalCurrency;
          data.lockedExchangeRate = 1;
        } else if (isPast) {
          data.currency = finalCurrency;
          const checkInStr = finalCheckIn.toISOString().split("T")[0];
          data.lockedExchangeRate = await getOrFetchHistoricalRate(finalCurrency, checkInStr);
        } else {
          data.currency = finalCurrency;
          data.lockedExchangeRate = null;
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
          const finalCurrency = (data.currency as string | undefined) ?? current.currency ?? "USD";
          const finalCheckIn = checkIn ? new Date(checkIn) : (current.checkIn ?? new Date());
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPast = finalCheckIn <= today;
          const shouldCompute = finalCurrency === "USD" || isPast;

          if (shouldCompute) {
            const finalHotelChainId = resolvedHotelChainId ?? current.hotelChainId;
            const finalPretax = resolvedPretax ?? Number(current.pretaxCost);
            const finalHotelChainSubBrandId =
              hotelChainSubBrandId !== undefined
                ? hotelChainSubBrandId || null
                : (current.hotelChainSubBrandId ?? null);

            if (finalHotelChainId && finalPretax) {
              // Resolve exchange rate for USD calculation
              const resolvedRate = data.lockedExchangeRate
                ? Number(data.lockedExchangeRate)
                : current.lockedExchangeRate
                  ? Number(current.lockedExchangeRate)
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
                  ? prisma.hotelChainSubBrand.findUnique({
                      where: { id: finalHotelChainSubBrandId },
                    })
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
                      pointsFloorTo: userStatus.eliteStatus.pointsFloorTo,
                    }
                  : null,
              });
            }
          }
        }
      }

      // Recompute lockedLoyaltyUsdCentsPerPoint when checkIn or hotelChainId changes,
      // using the program currency rate (not the booking currency) since programCentsPerPoint
      // is denominated in programCurrency regardless of what the guest paid in.
      if (checkIn !== undefined || hotelChainId !== undefined) {
        const finalCheckIn = checkIn ? new Date(checkIn) : (current.checkIn ?? new Date());
        const finalHotelChainId =
          hotelChainId !== undefined ? hotelChainId || null : (current.hotelChainId ?? null);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = finalCheckIn <= today;

        if (isPast && finalHotelChainId) {
          const hcWithPt = await prisma.hotelChain.findUnique({
            where: { id: finalHotelChainId },
            select: {
              pointType: { select: { programCurrency: true, programCentsPerPoint: true } },
            },
          });
          const pt = hcWithPt?.pointType;
          if (pt?.programCurrency != null && pt?.programCentsPerPoint != null) {
            const checkInStr = finalCheckIn.toISOString().split("T")[0];
            const programRate = await fetchExchangeRate(pt.programCurrency, checkInStr);
            data.lockedLoyaltyUsdCentsPerPoint = Number(pt.programCentsPerPoint) * programRate;
          } else {
            data.lockedLoyaltyUsdCentsPerPoint = null;
          }
        } else {
          // Booking moved to future, or no hotel chain — clear the locked rate
          data.lockedLoyaltyUsdCentsPerPoint = null;
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
              certType: v as CertType,
            })),
          });
        }
      }

      // Handle benefits: delete old ones and recreate if provided
      if (benefits !== undefined) {
        // Resolve effective hotelChainId for benefit validation:
        // body may not include it if the chain isn't being changed
        const effectiveHotelChainId =
          hotelChainId !== undefined ? hotelChainId || null : (current.hotelChainId ?? null);

        const benefitValidationError = await validateBenefits(
          benefits ?? [],
          effectiveHotelChainId
        );
        if (benefitValidationError) {
          return apiError(benefitValidationError, null, 400, request, { bookingId: id });
        }
        await prisma.bookingBenefit.deleteMany({
          where: { bookingId: id },
        });
        const validBenefits = (
          benefits as {
            benefitType: string;
            label?: string;
            dollarValue?: number | null;
            pointsEarnType?: string | null;
            pointsAmount?: number | null;
            pointsMultiplier?: number | null;
          }[]
        ).filter((b) => b.benefitType);
        if (validBenefits.length > 0) {
          await prisma.bookingBenefit.createMany({
            data: validBenefits.map((b) => ({
              bookingId: id,
              benefitType: b.benefitType as BenefitType,
              label: b.label || null,
              dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
              pointsEarnType: (b.pointsEarnType as BenefitPointsEarnType) || null,
              pointsAmount: b.pointsAmount != null ? Number(b.pointsAmount) : null,
              pointsMultiplier: b.pointsMultiplier != null ? Number(b.pointsMultiplier) : null,
            })),
          });
        }
      }

      // If geo fields are provided without a propertyName, update the existing property in place
      if (
        !resolvedPropertyId &&
        (countryCode !== undefined || city !== undefined || address !== undefined)
      ) {
        if (current.propertyId) {
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

      // Derive posting statuses: only reset to "pending" when the relevant entity changes;
      // otherwise preserve the current DB value so user-set statuses are not overwritten.
      // --- loyaltyPostingStatus ---
      // Loyalty is affected by: loyaltyPointsEarned, accommodationType, hotelChainId
      const finalLoyaltyPoints =
        loyaltyPointsEarned !== undefined
          ? (data.loyaltyPointsEarned as number | null | undefined)
          : current.loyaltyPointsEarned != null
            ? Number(current.loyaltyPointsEarned)
            : null;
      const finalAccommodationType =
        (data.accommodationType as string | undefined) ?? current.accommodationType;
      const finalHotelChainId =
        hotelChainId !== undefined
          ? (data.hotelChainId as string | null | undefined)
          : current.hotelChainId;

      const loyaltyEligible =
        finalLoyaltyPoints != null &&
        finalLoyaltyPoints > 0 &&
        finalAccommodationType !== "apartment" &&
        finalHotelChainId != null;

      let loyaltyPostingStatus: PostingStatus | null;
      if (!loyaltyEligible) {
        loyaltyPostingStatus = null;
      } else {
        const loyaltyChanged =
          (loyaltyPointsEarned !== undefined &&
            Number(loyaltyPointsEarned || null) !==
              (current.loyaltyPointsEarned != null ? Number(current.loyaltyPointsEarned) : null)) ||
          (accommodationType !== undefined && accommodationType !== current.accommodationType) ||
          (hotelChainId !== undefined && hotelChainId !== current.hotelChainId);
        if (loyaltyChanged) {
          loyaltyPostingStatus = "pending";
        } else {
          loyaltyPostingStatus = current.loyaltyPostingStatus ?? "pending";
        }
      }
      data.loyaltyPostingStatus = loyaltyPostingStatus;

      // --- cardRewardPostingStatus ---
      const finalUserCreditCardId =
        userCreditCardId !== undefined
          ? (data.userCreditCardId as string | null | undefined)
          : current.userCreditCardId;

      let cardRewardPostingStatus: PostingStatus | null;
      if (finalUserCreditCardId == null) {
        cardRewardPostingStatus = null;
      } else if (userCreditCardId !== undefined && userCreditCardId !== current.userCreditCardId) {
        // Card changed — reset to pending
        cardRewardPostingStatus = "pending";
      } else {
        // Card unchanged — preserve existing status
        cardRewardPostingStatus = current.cardRewardPostingStatus ?? "pending";
      }
      data.cardRewardPostingStatus = cardRewardPostingStatus;

      // --- portalCashbackPostingStatus ---
      const finalShoppingPortalId =
        shoppingPortalId !== undefined
          ? (data.shoppingPortalId as string | null | undefined)
          : current.shoppingPortalId;

      let portalCashbackPostingStatus: PostingStatus | null;
      if (finalShoppingPortalId == null) {
        portalCashbackPostingStatus = null;
      } else if (shoppingPortalId !== undefined && shoppingPortalId !== current.shoppingPortalId) {
        // Portal changed — reset to pending
        portalCashbackPostingStatus = "pending";
      } else {
        // Portal unchanged — preserve existing status
        portalCashbackPostingStatus = current.portalCashbackPostingStatus ?? "pending";
      }
      data.portalCashbackPostingStatus = portalCashbackPostingStatus;

      // Capture existing card benefit pairs before update so we can re-evaluate
      // periods that may no longer match after the change (e.g. card switched)
      const oldCardBenefitPairs = await prisma.bookingCardBenefit.findMany({
        where: { bookingId: id },
        select: {
          cardBenefitId: true,
          periodKey: true,
          booking: { select: { userCreditCardId: true } },
        },
      });

      const booking = await prisma.booking.update({
        where: { id },
        data,
      });

      logger.info("booking:updated", {
        userId,
        bookingId: id,
        fieldsUpdated: Object.keys(data),
      });

      // Re-run promotion matching after update
      const appliedPromoIds = await matchPromotionsForBooking(booking.id);

      // Re-evaluate subsequent bookings if this is an earlier stay
      await reevaluateSubsequentBookings(booking.id, appliedPromoIds);

      // Re-apply card benefits, including any periods affected before the change
      await reapplyCardBenefitsAffectedByBooking(
        booking.id,
        oldCardBenefitPairs
          .filter((p) => p.booking.userCreditCardId != null)
          .map((p) => ({
            benefitId: p.cardBenefitId,
            periodKey: p.periodKey,
            userCreditCardId: p.booking.userCreditCardId!,
          }))
      );

      // Fetch the booking with all relations to return
      const fullBooking = await getFullBookingWithUsage(booking.id, userId);

      return NextResponse.json(fullBooking);
    } catch (error) {
      return apiError("Failed to update booking", error, 500, request, { bookingId: id });
    }
  }
);

export const PATCH = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const {
        needsReview,
        loyaltyPostingStatus,
        cardRewardPostingStatus,
        portalCashbackPostingStatus,
      } = await request.json();

      const exists = await prisma.booking.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) return apiError("Booking not found", null, 404, request, { bookingId: id });

      const data: Record<string, unknown> = {};
      if (needsReview !== undefined) data.needsReview = needsReview;
      if (loyaltyPostingStatus !== undefined) data.loyaltyPostingStatus = loyaltyPostingStatus;
      if (cardRewardPostingStatus !== undefined)
        data.cardRewardPostingStatus = cardRewardPostingStatus;
      if (portalCashbackPostingStatus !== undefined)
        data.portalCashbackPostingStatus = portalCashbackPostingStatus;

      const booking = await prisma.booking.update({
        where: { id },
        data,
      });

      return NextResponse.json(booking);
    } catch (error) {
      return apiError("Failed to update booking", error, 500, request, { bookingId: id });
    }
  }
);

export const DELETE = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      // Find booking and its applied promotions before deleting (also verifies ownership)
      const booking = await prisma.booking.findFirst({
        where: { id, userId },
        select: {
          checkIn: true,
          userCreditCardId: true,
          bookingPromotions: { select: { promotionId: true } },
          bookingCardBenefits: { select: { cardBenefitId: true, periodKey: true } },
        },
      });

      if (!booking) {
        return apiError("Booking not found", null, 404, request, { bookingId: id });
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
      const cardBenefitPairs = booking.userCreditCardId
        ? booking.bookingCardBenefits.map((b) => ({
            benefitId: b.cardBenefitId,
            periodKey: b.periodKey,
            userCreditCardId: booking.userCreditCardId!,
          }))
        : [];

      // Delete associated booking promotions first
      await prisma.bookingPromotion.deleteMany({
        where: { bookingId: id },
      });

      await prisma.booking.delete({
        where: { id },
      });

      logger.info("booking:deleted", {
        userId,
        bookingId: id,
      });

      // Re-evaluate subsequent bookings
      if (subsequentBookingIds.length > 0) {
        await reevaluateBookings(subsequentBookingIds);
      }

      // Re-evaluate card benefit periods freed by this deletion
      for (const { benefitId, periodKey, userCreditCardId } of cardBenefitPairs) {
        await reapplyBenefitForPeriod(benefitId, periodKey, userCreditCardId);
      }

      return NextResponse.json({ message: "Booking deleted" });
    } catch (error) {
      return apiError("Failed to delete booking", error, 500, request, { bookingId: id });
    }
  }
);
