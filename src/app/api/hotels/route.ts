import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const hotels = await prisma.hotel.findMany({
      include: { pointType: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(hotels);
  } catch (error) {
    return apiError("Failed to fetch hotels", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, loyaltyProgram, basePointRate, elitePointRate, pointTypeId } = body;

    const hotel = await prisma.hotel.create({
      data: {
        name,
        loyaltyProgram,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
        elitePointRate: elitePointRate != null ? Number(elitePointRate) : null,
        pointTypeId: pointTypeId ? Number(pointTypeId) : null,
      },
      include: { pointType: true },
    });

    return NextResponse.json(hotel, { status: 201 });
  } catch (error) {
    return apiError("Failed to create hotel", error);
  }
}
