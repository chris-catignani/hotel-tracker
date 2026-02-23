import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, rewardType, rewardRate, pointTypeId } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (rewardType !== undefined) data.rewardType = rewardType;
    if (rewardRate !== undefined) data.rewardRate = Number(rewardRate);
    if (pointTypeId !== undefined) data.pointTypeId = pointTypeId ? Number(pointTypeId) : null;

    const creditCard = await prisma.creditCard.update({
      where: { id: Number(id) },
      data,
      include: { pointType: true },
    });

    return NextResponse.json(creditCard);
  } catch (error) {
    return apiError("Failed to update credit card", error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.creditCard.update({
      where: { id: Number(id) },
      data: { isDeleted: true },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete credit card", error);
  }
}
