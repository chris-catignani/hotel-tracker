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
    const { name, category, centsPerPoint } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (centsPerPoint !== undefined) data.centsPerPoint = Number(centsPerPoint);

    const pointType = await prisma.pointType.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(pointType);
  } catch (error) {
    return apiError("Failed to update point type", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = Number(id);

    // Check if in use
    const hotelChainCount = await prisma.hotelChain.count({ where: { pointTypeId: numId } });
    const cardCount = await prisma.creditCard.count({ where: { pointTypeId: numId } });
    const portalCount = await prisma.shoppingPortal.count({ where: { pointTypeId: numId } });

    if (hotelChainCount + cardCount + portalCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete: point type is in use by hotel chains, cards, or portals" },
        { status: 409 }
      );
    }

    await prisma.pointType.delete({ where: { id: numId } });

    return NextResponse.json({ message: "Point type deleted" });
  } catch (error) {
    return apiError("Failed to delete point type", error);
  }
}
