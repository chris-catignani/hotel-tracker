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
    const { name, loyaltyProgram, basePointRate, elitePointRate, pointValue } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (loyaltyProgram !== undefined) data.loyaltyProgram = loyaltyProgram || null;
    if (basePointRate !== undefined)
      data.basePointRate = basePointRate != null ? Number(basePointRate) : null;
    if (elitePointRate !== undefined)
      data.elitePointRate = elitePointRate != null ? Number(elitePointRate) : null;
    if (pointValue !== undefined)
      data.pointValue = pointValue != null ? Number(pointValue) : null;

    const hotel = await prisma.hotel.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(hotel);
  } catch (error) {
    return apiError("Failed to update hotel", error);
  }
}
