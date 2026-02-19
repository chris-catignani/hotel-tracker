import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name } = await request.json();
    const agency = await prisma.otaAgency.update({
      where: { id: Number(id) },
      data: { name },
    });
    return NextResponse.json(agency);
  } catch (error) {
    return apiError("Failed to update OTA agency", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingCount = await prisma.booking.count({
      where: { otaAgencyId: Number(id) },
    });
    if (bookingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete: agency is referenced by existing bookings." },
        { status: 409 }
      );
    }
    await prisma.otaAgency.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "OTA agency deleted" });
  } catch (error) {
    return apiError("Failed to delete OTA agency", error);
  }
}
