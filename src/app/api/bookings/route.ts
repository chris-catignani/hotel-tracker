import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        hotel: true,
        creditCard: true,
        shoppingPortal: true,
        bookingPromotions: {
          include: {
            promotion: true,
          },
        },
      },
      orderBy: {
        checkIn: "desc",
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
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
      loyaltyPointsEarned,
      notes,
    } = body;

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
        loyaltyPointsEarned: loyaltyPointsEarned
          ? Number(loyaltyPointsEarned)
          : null,
        notes: notes || null,
      },
    });

    // Auto-run promotion matching
    await matchPromotionsForBooking(booking.id);

    // Fetch the booking with all relations to return
    const fullBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        hotel: true,
        creditCard: true,
        shoppingPortal: true,
        bookingPromotions: {
          include: {
            promotion: true,
          },
        },
      },
    });

    return NextResponse.json(fullBooking, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
