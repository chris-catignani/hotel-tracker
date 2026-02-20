import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hotelChainSubBrands = await prisma.hotelChainSubBrand.findMany({
      where: { hotelChainId: Number(id) },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(hotelChainSubBrands);
  } catch (error) {
    return apiError("Failed to fetch hotel chain sub-brands", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, basePointRate } = body;

    const hotelChainSubBrand = await prisma.hotelChainSubBrand.create({
      data: {
        hotelChainId: Number(id),
        name,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
      },
    });

    return NextResponse.json(hotelChainSubBrand, { status: 201 });
  } catch (error) {
    return apiError("Failed to create hotel chain sub-brand", error);
  }
}
