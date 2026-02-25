import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const subBrands = await prisma.hotelChainSubBrand.findMany({
      where: { hotelChainId: id },
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(subBrands);
  } catch (error) {
    return apiError("Failed to fetch sub-brands", error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, basePointRate } = await request.json();

    const subBrand = await prisma.hotelChainSubBrand.create({
      data: {
        hotelChainId: id,
        name,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
      },
    });

    return NextResponse.json(subBrand, { status: 201 });
  } catch (error) {
    return apiError("Failed to create sub-brand", error);
  }
}
