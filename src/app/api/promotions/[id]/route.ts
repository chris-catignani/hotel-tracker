import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { matchPromotionsForAffectedBookings, reevaluateBookings } from "@/lib/promotion-matching";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promotion = await prisma.promotion.findUnique({
      where: { id: Number(id) },
      include: {
        hotelChain: true,
        hotelChainSubBrand: true,
        creditCard: true,
        shoppingPortal: true,
      },
    });

    if (!promotion) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(promotion);
  } catch (error) {
    return apiError("Failed to fetch promotion", error);
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
      name,
      type,
      valueType,
      value,
      hotelChainId,
      hotelChainSubBrandId,
      creditCardId,
      shoppingPortalId,
      minSpend,
      startDate,
      endDate,
      isActive,
    } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (valueType !== undefined) data.valueType = valueType;
    if (value !== undefined) data.value = Number(value);
    if (hotelChainId !== undefined) data.hotelChainId = hotelChainId ? Number(hotelChainId) : null;
    if (hotelChainSubBrandId !== undefined)
      data.hotelChainSubBrandId = hotelChainSubBrandId ? Number(hotelChainSubBrandId) : null;
    if (creditCardId !== undefined)
      data.creditCardId = creditCardId ? Number(creditCardId) : null;
    if (shoppingPortalId !== undefined)
      data.shoppingPortalId = shoppingPortalId
        ? Number(shoppingPortalId)
        : null;
    if (minSpend !== undefined)
      data.minSpend = minSpend != null ? Number(minSpend) : null;
    if (startDate !== undefined)
      data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined)
      data.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const promotion = await prisma.promotion.update({
      where: { id: Number(id) },
      data,
    });

    await matchPromotionsForAffectedBookings(promotion.id);

    return NextResponse.json(promotion);
  } catch (error) {
    return apiError("Failed to update promotion", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promotionId = Number(id);

    // Find bookings that currently have this promotion applied
    const affectedBookings = await prisma.booking.findMany({
      where: {
        bookingPromotions: {
          some: { promotionId },
        },
      },
      select: { id: true },
    });

    await prisma.promotion.delete({
      where: { id: promotionId },
    });

    // Re-evaluate affected bookings after deletion.
    // Note: While Prisma cascade deletes will remove BookingPromotion records, 
    // we manually re-evaluate to ensure the bookings are correctly updated 
    // (e.g., if other promotions now apply or if summary totals need refresh).
    if (affectedBookings.length > 0) {
      await reevaluateBookings(affectedBookings.map((b) => b.id));
    }

    return NextResponse.json({ message: "Promotion deleted" });
  } catch (error) {
    return apiError("Failed to delete promotion", error);
  }
}
