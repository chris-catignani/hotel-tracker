import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { recalculateLoyaltyForHotelChain } from "@/lib/loyalty-recalculation";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/auth-utils";
import { normalizeUserStatuses } from "@/lib/normalize-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const hotelChain = await prisma.hotelChain.findUnique({
      where: { id: id },
      include: {
        pointType: true,
        hotelChainSubBrands: true,
        eliteStatuses: true,
        userStatuses: {
          where: { userId },
          include: { eliteStatus: true },
          take: 1,
        },
      },
    });
    if (!hotelChain) return apiError("Hotel chain not found", null, 404, request);
    return NextResponse.json(normalizeUserStatuses(hotelChain));
  } catch (error) {
    return apiError("Failed to fetch hotel chain", error, 500, request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const body = await request.json();
    const { name, loyaltyProgram, basePointRate, calculationCurrency, pointTypeId } = body;

    // Check if rate-affecting fields are changing to avoid unnecessary recalculations
    const existing = await prisma.hotelChain.findUnique({
      where: { id: id },
      select: { basePointRate: true, calculationCurrency: true },
    });

    if (calculationCurrency !== undefined) {
      const resolvedCurrency: string = calculationCurrency || "USD";
      if (!/^[A-Z]{3}$/.test(resolvedCurrency)) {
        return apiError(
          "Invalid calculationCurrency: must be a 3-letter ISO 4217 code",
          null,
          400,
          request
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (loyaltyProgram !== undefined) data.loyaltyProgram = loyaltyProgram || null;
    if (basePointRate !== undefined)
      data.basePointRate = basePointRate != null ? Number(basePointRate) : null;
    if (calculationCurrency !== undefined) data.calculationCurrency = calculationCurrency || "USD";
    if (pointTypeId !== undefined) data.pointTypeId = pointTypeId || null;

    const hotelChain = await prisma.hotelChain.update({
      where: { id: id },
      data,
      include: {
        pointType: true,
        eliteStatuses: { orderBy: { eliteTierLevel: "asc" } },
        userStatuses: {
          where: { userId },
          include: { eliteStatus: true },
          take: 1,
        },
      },
    });

    // Recalculate loyalty points if the base rate or calculation currency changed
    const rateChanged =
      basePointRate !== undefined && Number(existing?.basePointRate) !== Number(basePointRate);
    const currencyChanged =
      calculationCurrency !== undefined &&
      (existing?.calculationCurrency ?? "USD") !== (calculationCurrency || "USD");
    if (rateChanged || currencyChanged) {
      await recalculateLoyaltyForHotelChain(id, userId);
    }

    return NextResponse.json(normalizeUserStatuses(hotelChain));
  } catch (error) {
    return apiError("Failed to update hotel chain", error, 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const { id } = await params;

    // Check for existing bookings
    const bookingCount = await prisma.booking.count({
      where: { hotelChainId: id },
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete hotel chain with existing bookings" },
        { status: 409 }
      );
    }

    // Check for existing sub-brands
    const subBrandCount = await prisma.hotelChainSubBrand.count({
      where: { hotelChainId: id },
    });

    if (subBrandCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete hotel chain with existing sub-brands" },
        { status: 409 }
      );
    }

    await prisma.hotelChain.delete({
      where: { id: id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete hotel chain", error, 500, request);
  }
}
