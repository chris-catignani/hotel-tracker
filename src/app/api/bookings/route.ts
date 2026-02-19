import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        hotel: { include: { pointType: true } },
        creditCard: { include: { pointType: true } },
        shoppingPortal: { include: { pointType: true } },
        bookingPromotions: {
          include: {
            promotion: true,
          },
        },
        certificates: true,
        otaAgency: true,
        benefits: true,
      },
      orderBy: {
        checkIn: "asc",
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    return apiError("Failed to fetch bookings", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      hotelId,
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
    } = body;

    // Auto-calculate loyalty points from hotel rates if not explicitly provided
    let calculatedPoints: number | null = loyaltyPointsEarned
      ? Number(loyaltyPointsEarned)
      : null;
    if (calculatedPoints == null && hotelId && pretaxCost) {
      const hotel = await prisma.hotel.findUnique({
        where: { id: Number(hotelId) },
      });
      if (hotel?.basePointRate != null) {
        const baseRate = Number(hotel.basePointRate);
        const eliteRate = Number(hotel.elitePointRate || 0);
        calculatedPoints = Math.round(Number(pretaxCost) * (baseRate + eliteRate));
      }
    }

    const booking = await prisma.booking.create({
      data: {
        hotelId: Number(hotelId),
        propertyName,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        numNights: Number(numNights),
        pretaxCost: Number(pretaxCost),
        taxAmount: Number(taxAmount),
        totalCost: Number(totalCost),
        creditCardId: creditCardId ? Number(creditCardId) : null,
        shoppingPortalId: shoppingPortalId ? Number(shoppingPortalId) : null,
        portalCashbackRate: portalCashbackRate
          ? Number(portalCashbackRate)
          : null,
        portalCashbackOnTotal: portalCashbackOnTotal ?? false,
        loyaltyPointsEarned: calculatedPoints,
        pointsRedeemed: pointsRedeemed ? Number(pointsRedeemed) : null,
        currency: currency || "USD",
        originalAmount: originalAmount ? Number(originalAmount) : null,
        notes: notes || null,
        bookingSource: bookingSource || null,
        otaAgencyId: bookingSource === "ota" && otaAgencyId ? Number(otaAgencyId) : null,
        certificates: certificates?.length
          ? { create: (certificates as string[]).map((v) => ({ value: v })) }
          : undefined,
        benefits: benefits?.length
          ? {
              create: (benefits as { benefitType: string; label?: string; dollarValue?: number }[])
                .filter((b) => b.benefitType)
                .map((b) => ({
                  benefitType: b.benefitType as import("@prisma/client").BenefitType,
                  label: b.label || null,
                  dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
                })),
            }
          : undefined,
      },
    });

    // Auto-run promotion matching
    await matchPromotionsForBooking(booking.id);

    // Fetch the booking with all relations to return
    const fullBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        hotel: { include: { pointType: true } },
        creditCard: { include: { pointType: true } },
        shoppingPortal: { include: { pointType: true } },
        bookingPromotions: {
          include: {
            promotion: true,
          },
        },
        certificates: true,
        otaAgency: true,
        benefits: true,
      },
    });

    return NextResponse.json(fullBooking, { status: 201 });
  } catch (error) {
    return apiError("Failed to create booking", error);
  }
}
