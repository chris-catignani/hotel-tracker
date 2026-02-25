import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, basePointRate } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (basePointRate !== undefined)
      data.basePointRate = basePointRate != null ? Number(basePointRate) : null;

    const subBrand = await prisma.hotelChainSubBrand.update({
      where: { id: id },
      data,
    });

    return NextResponse.json(subBrand);
  } catch (error) {
    return apiError("Failed to update sub-brand", error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if sub-brand is in use
    const bookingCount = await prisma.booking.count({
      where: { hotelChainSubBrandId: id },
    });

    if (bookingCount > 0) {
      return apiError("Cannot delete sub-brand that is in use by bookings", null, 400);
    }

    await prisma.hotelChainSubBrand.delete({
      where: { id: id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete sub-brand", error);
  }
}
