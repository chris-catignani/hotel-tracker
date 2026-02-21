import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { recalculateLoyaltyForHotelChain } from "@/lib/loyalty-recalculation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, loyaltyProgram, basePointRate, pointTypeId } = body;

    // Check if basePointRate is changing to avoid unnecessary recalculations
    const existing = await prisma.hotelChain.findUnique({
      where: { id: Number(id) },
      select: { basePointRate: true }
    });

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (loyaltyProgram !== undefined) data.loyaltyProgram = loyaltyProgram || null;
    if (basePointRate !== undefined)
      data.basePointRate = basePointRate != null ? Number(basePointRate) : null;
    if (pointTypeId !== undefined)
      data.pointTypeId = pointTypeId ? Number(pointTypeId) : null;

    const hotelChain = await prisma.hotelChain.update({
      where: { id: Number(id) },
      data,
      include: {
        pointType: true,
        eliteStatuses: { orderBy: { eliteTierLevel: "asc" } },
        userStatus: { include: { eliteStatus: true } },
      },
    });

    // Recalculate loyalty points if the base rate changed
    if (basePointRate !== undefined && Number(existing?.basePointRate) !== Number(basePointRate)) {
      await recalculateLoyaltyForHotelChain(hotelChain.id);
    }

    return NextResponse.json(hotelChain);
  } catch (error) {
    return apiError("Failed to update hotel chain", error);
  }
}
