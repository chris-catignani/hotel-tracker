import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subBrands = await prisma.hotelSubBrand.findMany({
      where: { hotelId: Number(id) },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(subBrands);
  } catch (error) {
    return apiError("Failed to fetch sub-brands", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, basePointRate, elitePointRate } = body;

    const subBrand = await prisma.hotelSubBrand.create({
      data: {
        hotelId: Number(id),
        name,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
        elitePointRate: elitePointRate != null ? Number(elitePointRate) : null,
      },
    });

    return NextResponse.json(subBrand, { status: 201 });
  } catch (error) {
    return apiError("Failed to create sub-brand", error);
  }
}
