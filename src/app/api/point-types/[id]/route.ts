import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const { id } = await params;
    const body = await request.json();
    const { name, category, usdCentsPerPoint, programCurrency, programCentsPerPoint } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (usdCentsPerPoint !== undefined) data.usdCentsPerPoint = Number(usdCentsPerPoint);
    if (programCurrency !== undefined) data.programCurrency = programCurrency ?? null;
    if (programCentsPerPoint !== undefined)
      data.programCentsPerPoint =
        programCentsPerPoint != null ? Number(programCentsPerPoint) : null;

    const pointType = await prisma.pointType.update({
      where: { id: id },
      data,
    });

    return NextResponse.json(pointType);
  } catch (error) {
    return apiError("Failed to update point type", error, 500, request, { pointTypeId: id });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const { id } = await params;

    // Check if in use
    const hotelChainCount = await prisma.hotelChain.count({ where: { pointTypeId: id } });
    const creditCardCount = await prisma.creditCard.count({ where: { pointTypeId: id } });
    const portalCount = await prisma.shoppingPortal.count({ where: { pointTypeId: id } });

    if (hotelChainCount > 0 || creditCardCount > 0 || portalCount > 0) {
      return apiError(
        "Cannot delete point type that is in use by other records",
        null,
        400,
        request,
        { pointTypeId: id }
      );
    }

    await prisma.pointType.delete({ where: { id: id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete point type", error, 500, request, { pointTypeId: id });
  }
}
