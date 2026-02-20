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
    const { name, loyaltyProgram, basePointRate, pointTypeId } = body;

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
      include: { pointType: true, eliteStatuses: true, userStatus: true },
    });

    return NextResponse.json(hotelChain);
  } catch (error) {
    return apiError("Failed to update hotel chain", error);
  }
}
