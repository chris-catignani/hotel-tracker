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

    const hotelChainSubBrand = await prisma.hotelChainSubBrand.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(hotelChainSubBrand);
  } catch (error) {
    return apiError("Failed to update hotel chain sub-brand", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bookingCount = await prisma.booking.count({
      where: { hotelChainSubBrandId: Number(id) },
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete hotel chain sub-brand with existing bookings" },
        { status: 409 }
      );
    }

    await prisma.hotelChainSubBrand.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Hotel chain sub-brand deleted" });
  } catch (error) {
    return apiError("Failed to delete hotel chain sub-brand", error);
  }
}
