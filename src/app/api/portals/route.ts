import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const portals = await prisma.shoppingPortal.findMany({
      include: { pointType: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(portals);
  } catch (error) {
    return apiError("Failed to fetch portals", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, rewardType, pointTypeId } = body;

    const portal = await prisma.shoppingPortal.create({
      data: {
        name,
        rewardType: rewardType ?? "cashback",
        pointTypeId: pointTypeId ? Number(pointTypeId) : null,
      },
      include: { pointType: true },
    });

    return NextResponse.json(portal, { status: 201 });
  } catch (error) {
    return apiError("Failed to create portal", error);
  }
}
