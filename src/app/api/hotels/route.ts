import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const hotels = await prisma.hotel.findMany();
    return NextResponse.json(hotels);
  } catch (error) {
    return apiError("Failed to fetch hotels", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, loyaltyProgram, basePointRate, elitePointRate, pointValue } = body;

    const hotel = await prisma.hotel.create({
      data: {
        name,
        loyaltyProgram,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
        elitePointRate: elitePointRate != null ? Number(elitePointRate) : null,
        pointValue: pointValue != null ? Number(pointValue) : null,
      },
    });

    return NextResponse.json(hotel, { status: 201 });
  } catch (error) {
    return apiError("Failed to create hotel", error);
  }
}
