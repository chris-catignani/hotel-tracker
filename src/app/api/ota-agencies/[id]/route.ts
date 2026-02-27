import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agency = await prisma.otaAgency.findUnique({
      where: { id: id },
    });
    if (!agency) return apiError("Agency not found", null, 404, request);
    return NextResponse.json(agency);
  } catch (error) {
    return apiError("Failed to fetch agency", error, 500, request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name } = await request.json();
    const agency = await prisma.otaAgency.update({
      where: { id: id },
      data: { name },
    });
    return NextResponse.json(agency);
  } catch (error) {
    return apiError("Failed to update agency", error, 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if being used by any bookings
    const count = await prisma.booking.count({
      where: { otaAgencyId: id },
    });
    if (count > 0) {
      return apiError("Cannot delete agency that is in use by bookings", null, 400, request);
    }

    await prisma.otaAgency.delete({ where: { id: id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete agency", error, 500, request);
  }
}
