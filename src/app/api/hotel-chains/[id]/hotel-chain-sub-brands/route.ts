import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const subBrands = await prisma.hotelChainSubBrand.findMany({
      where: { hotelChainId: id },
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(subBrands);
  } catch (error) {
    return apiError("Failed to fetch sub-brands", error, 500, request, { hotelChainId: id });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

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
    return apiError("Failed to create sub-brand", error, 500, request, { hotelChainId: id });
  }
}
