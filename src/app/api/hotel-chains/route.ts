import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const hotelChains = await prisma.hotelChain.findMany({
      include: { hotelChainSubBrands: { orderBy: { name: "asc" } }, pointType: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(hotelChains);
  } catch (error) {
    return apiError("Failed to fetch hotel chains", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, loyaltyProgram, basePointRate, elitePointRate, pointTypeId } = body;

    const hotelChain = await prisma.hotelChain.create({
      data: {
        name,
        loyaltyProgram,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
        elitePointRate: elitePointRate != null ? Number(elitePointRate) : null,
        pointTypeId: pointTypeId ? Number(pointTypeId) : null,
      },
      include: { pointType: true },
    });

    return NextResponse.json(hotelChain, { status: 201 });
  } catch (error) {
    return apiError("Failed to create hotel chain", error);
  }
}
