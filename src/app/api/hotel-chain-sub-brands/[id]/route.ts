import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";
import { recalculateLoyaltyForHotelChain } from "@/lib/loyalty-recalculation";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const body = await request.json();
    const { name, basePointRate } = body;

    // Fetch existing sub-brand to detect rate change and get hotelChainId
    const existing = await prisma.hotelChainSubBrand.findUnique({
      where: { id },
      select: { hotelChainId: true, basePointRate: true },
    });
    if (!existing) {
      return apiError("Sub-brand not found", null, 404, request, { subBrandId: id });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (basePointRate !== undefined)
      data.basePointRate = basePointRate != null ? Number(basePointRate) : null;

    const subBrand = await prisma.hotelChainSubBrand.update({
      where: { id },
      data,
    });

    // Recalculate loyalty for all users if basePointRate changed
    const rateChanged =
      basePointRate !== undefined && Number(existing.basePointRate) !== Number(basePointRate);
    if (rateChanged) {
      await recalculateLoyaltyForHotelChain(existing.hotelChainId);
    }

    return NextResponse.json(subBrand);
  } catch (error) {
    return apiError("Failed to update sub-brand", error, 500, request, { subBrandId: id });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    // Check if sub-brand is in use
    const bookingCount = await prisma.booking.count({
      where: { hotelChainSubBrandId: id },
    });

    if (bookingCount > 0) {
      return apiError("Cannot delete sub-brand that is in use by bookings", null, 400, request, {
        subBrandId: id,
      });
    }

    await prisma.hotelChainSubBrand.delete({
      where: { id: id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete sub-brand", error, 500, request, { subBrandId: id });
  }
}
