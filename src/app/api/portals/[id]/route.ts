import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, rewardType, pointTypeId } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (rewardType !== undefined) data.rewardType = rewardType;
    if (pointTypeId !== undefined) data.pointTypeId = pointTypeId || null;

    const portal = await prisma.shoppingPortal.update({
      where: { id: id },
      data,
      include: { pointType: true },
    });

    return NextResponse.json(portal);
  } catch (error) {
    return apiError("Failed to update portal", error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.shoppingPortal.delete({
      where: { id: id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError("Failed to delete portal", error);
  }
}
