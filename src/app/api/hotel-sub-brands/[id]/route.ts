import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, basePointRate, elitePointRate } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (basePointRate !== undefined)
      data.basePointRate = basePointRate != null ? Number(basePointRate) : null;
    if (elitePointRate !== undefined)
      data.elitePointRate =
        elitePointRate != null ? Number(elitePointRate) : null;

    const subBrand = await prisma.hotelSubBrand.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(subBrand);
  } catch (error) {
    return apiError("Failed to update sub-brand", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bookingCount = await prisma.booking.count({
      where: { subBrandId: Number(id) },
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete sub-brand with existing bookings" },
        { status: 409 }
      );
    }

    await prisma.hotelSubBrand.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Sub-brand deleted" });
  } catch (error) {
    return apiError("Failed to delete sub-brand", error);
  }
}
