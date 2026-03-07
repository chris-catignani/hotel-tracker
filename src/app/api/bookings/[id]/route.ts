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
import { calculatePoints } from "@/lib/loyalty-utils";

async function getFullBookingWithUsage(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: id },
    include: {
      hotelChain: {
        include: {
          pointType: true,
          userStatus: { include: { eliteStatus: true } },
        },
      },
      hotelChainSubBrand: true,
      creditCard: { include: { pointType: true, rewardRules: true } },
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

  return {
    ...booking,
    bookingPromotions: enhancedBookingPromotions,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const booking = await getFullBookingWithUsage(id);

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
    const { id } = await params;
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
      originalAmount,
      certificates,
      bookingSource,
      otaAgencyId,
      benefits,
      notes,
      hotelChainSubBrandId,
    } = body;

    const data: Record<string, unknown> = {};
    if (hotelChainId !== undefined) data.hotelChainId = hotelChainId;
    if (hotelChainSubBrandId !== undefined)
      data.hotelChainSubBrandId = hotelChainSubBrandId || null;
    if (propertyName !== undefined) data.propertyName = propertyName;
    if (checkIn !== undefined) data.checkIn = new Date(checkIn);
    if (checkOut !== undefined) data.checkOut = new Date(checkOut);
    if (numNights !== undefined) data.numNights = Number(numNights);
    if (pretaxCost !== undefined) data.pretaxCost = Number(pretaxCost);
    if (taxAmount !== undefined) data.taxAmount = Number(taxAmount);
    if (totalCost !== undefined) data.totalCost = Number(totalCost);
    if (creditCardId !== undefined) data.creditCardId = creditCardId || null;
    if (shoppingPortalId !== undefined) data.shoppingPortalId = shoppingPortalId || null;
    if (portalCashbackRate !== undefined)
      data.portalCashbackRate = portalCashbackRate ? Number(portalCashbackRate) : null;
    if (loyaltyPointsEarned !== undefined)
      data.loyaltyPointsEarned = loyaltyPointsEarned ? Number(loyaltyPointsEarned) : null;
    if (portalCashbackOnTotal !== undefined) data.portalCashbackOnTotal = portalCashbackOnTotal;
    if (pointsRedeemed !== undefined)
      data.pointsRedeemed = pointsRedeemed ? Number(pointsRedeemed) : null;
    if (currency !== undefined) data.currency = currency;
    if (originalAmount !== undefined)
      data.originalAmount = originalAmount ? Number(originalAmount) : null;
    if (notes !== undefined) data.notes = notes || null;
    if (bookingSource !== undefined) {
      data.bookingSource = bookingSource || null;
      data.otaAgencyId = bookingSource === "ota" && otaAgencyId ? otaAgencyId : null;
    }

    // Auto-calculate loyalty points if not explicitly provided but hotel/pretax changed
    if (loyaltyPointsEarned === undefined || loyaltyPointsEarned === null) {
      const resolvedHotelChainId = hotelChainId;
      const resolvedPretax = pretaxCost !== undefined ? Number(pretaxCost) : undefined;

      if (resolvedHotelChainId || resolvedPretax) {
        // Fetch current booking to fill in missing values
        const current = await prisma.booking.findUnique({
          where: { id: id },
        });
        const finalHotelChainId = resolvedHotelChainId ?? current?.hotelChainId;
        const finalPretax = resolvedPretax ?? (current ? Number(current.pretaxCost) : null);
        const finalHotelChainSubBrandId =
          hotelChainSubBrandId !== undefined
            ? hotelChainSubBrandId || null
            : (current?.hotelChainSubBrandId ?? null);

        if (finalHotelChainId && finalPretax) {
          // Fetch UserStatus for this chain
          const userStatus = await prisma.userStatus.findUnique({
            where: { hotelChainId: finalHotelChainId },
            include: { eliteStatus: true },
          });

          let basePointRate: number | null = null;
          if (finalHotelChainSubBrandId) {
            const subBrand = await prisma.hotelChainSubBrand.findUnique({
              where: { id: finalHotelChainSubBrandId },
            });
            if (subBrand?.basePointRate != null) {
              basePointRate = Number(subBrand.basePointRate);
            }
          }
          if (basePointRate == null) {
            const hotelChain = await prisma.hotelChain.findUnique({
              where: { id: finalHotelChainId },
            });
            if (hotelChain?.basePointRate != null) {
              basePointRate = Number(hotelChain.basePointRate);
            }
          }

          data.loyaltyPointsEarned = calculatePoints({
            pretaxCost: Number(finalPretax),
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

    const booking = await prisma.booking.update({
      where: { id: id },
      data,
    });

    // Re-run promotion matching after update
    const appliedPromoIds = await matchPromotionsForBooking(booking.id);

    // Re-evaluate subsequent bookings if this is an earlier stay
    await reevaluateSubsequentBookings(booking.id, appliedPromoIds);

    // Fetch the booking with all relations to return
    const fullBooking = await getFullBookingWithUsage(booking.id);

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
    const { id } = await params;

    // Find booking and its applied promotions before deleting
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        checkIn: true,
        bookingPromotions: { select: { promotionId: true } },
      },
    });

    if (!booking) {
      return apiError("Booking not found", null, 404, request);
    }

    // Capture promotion IDs and find affected subsequent bookings BEFORE deleting.
    // A booking with no promotions cannot affect any subsequent booking's priorUsage
    // (fetchPromotionUsage only reads BookingPromotion records), so no cascade is needed.
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

    // Delete associated booking promotions first
    await prisma.bookingPromotion.deleteMany({
      where: { bookingId: id },
    });

    await prisma.booking.delete({
      where: { id: id },
    });

    // Re-evaluate subsequent bookings
    if (subsequentBookingIds.length > 0) {
      await reevaluateBookings(subsequentBookingIds);
    }

    return NextResponse.json({ message: "Booking deleted" });
  } catch (error) {
    return apiError("Failed to delete booking", error, 500, request);
  }
}
