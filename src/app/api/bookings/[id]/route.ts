import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import { apiError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id: Number(id) },
      include: {
        hotel: { include: { pointType: true } },
        creditCard: { include: { pointType: true } },
        shoppingPortal: { include: { pointType: true } },
        bookingPromotions: {
          include: {
            promotion: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    return apiError("Failed to fetch booking", error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      notes,
    } = body;

    const data: Record<string, unknown> = {};
    if (hotelId !== undefined) data.hotelId = Number(hotelId);
    if (propertyName !== undefined) data.propertyName = propertyName;
    if (checkIn !== undefined) data.checkIn = new Date(checkIn);
    if (checkOut !== undefined) data.checkOut = new Date(checkOut);
    if (numNights !== undefined) data.numNights = Number(numNights);
    if (pretaxCost !== undefined) data.pretaxCost = Number(pretaxCost);
    if (taxAmount !== undefined) data.taxAmount = Number(taxAmount);
    if (totalCost !== undefined) data.totalCost = Number(totalCost);
    if (creditCardId !== undefined)
      data.creditCardId = creditCardId ? Number(creditCardId) : null;
    if (shoppingPortalId !== undefined)
      data.shoppingPortalId = shoppingPortalId
        ? Number(shoppingPortalId)
        : null;
    if (portalCashbackRate !== undefined)
      data.portalCashbackRate = portalCashbackRate
        ? Number(portalCashbackRate)
        : null;
    if (loyaltyPointsEarned !== undefined)
      data.loyaltyPointsEarned = loyaltyPointsEarned
        ? Number(loyaltyPointsEarned)
        : null;
    if (portalCashbackOnTotal !== undefined) data.portalCashbackOnTotal = portalCashbackOnTotal;
    if (notes !== undefined) data.notes = notes || null;

    // Auto-calculate loyalty points if not explicitly provided but hotel/pretax changed
    if (loyaltyPointsEarned === undefined || loyaltyPointsEarned === null) {
      const resolvedHotelId = hotelId !== undefined ? Number(hotelId) : undefined;
      const resolvedPretax = pretaxCost !== undefined ? Number(pretaxCost) : undefined;

      if (resolvedHotelId || resolvedPretax) {
        // Fetch current booking to fill in missing values
        const current = await prisma.booking.findUnique({
          where: { id: Number(id) },
        });
        const finalHotelId = resolvedHotelId ?? current?.hotelId;
        const finalPretax = resolvedPretax ?? (current ? Number(current.pretaxCost) : null);

        if (finalHotelId && finalPretax) {
          const hotel = await prisma.hotel.findUnique({
            where: { id: finalHotelId },
          });
          if (hotel?.basePointRate != null) {
            const baseRate = Number(hotel.basePointRate);
            const eliteRate = Number(hotel.elitePointRate || 0);
            data.loyaltyPointsEarned = Math.round(finalPretax * (baseRate + eliteRate));
          }
        }
      }
    }

    const booking = await prisma.booking.update({
      where: { id: Number(id) },
      data,
    });

    // Re-run promotion matching after update
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
      },
    });

    return NextResponse.json(fullBooking);
  } catch (error) {
    return apiError("Failed to update booking", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete associated booking promotions first
    await prisma.bookingPromotion.deleteMany({
      where: { bookingId: Number(id) },
    });

    await prisma.booking.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Booking deleted" });
  } catch (error) {
    return apiError("Failed to delete booking", error);
  }
}
