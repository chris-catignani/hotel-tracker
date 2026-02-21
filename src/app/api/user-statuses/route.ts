import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { recalculateLoyaltyForHotelChain } from "@/lib/loyalty-recalculation";

export async function GET() {
  try {
    const statuses = await prisma.userStatus.findMany({
      include: {
        hotelChain: true,
        eliteStatus: true,
      },
      orderBy: {
        hotelChain: {
          name: "asc",
        },
      },
    });
    return NextResponse.json(statuses);
  } catch (error) {
    return apiError("Failed to fetch user statuses", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { hotelChainId, eliteStatusId } = await request.json();

    // Check if status is actually changing
    const existing = await prisma.userStatus.findUnique({
      where: { hotelChainId: Number(hotelChainId) },
      select: { eliteStatusId: true }
    });

    // Validate that eliteStatusId belongs to hotelChainId
    if (eliteStatusId) {
      const eliteStatus = await prisma.hotelChainEliteStatus.findUnique({
        where: { id: Number(eliteStatusId) },
      });
      if (!eliteStatus || eliteStatus.hotelChainId !== Number(hotelChainId)) {
        return NextResponse.json(
          { error: "Elite status does not belong to the specified hotel chain" },
          { status: 400 }
        );
      }
    }

    const status = await prisma.userStatus.upsert({
      where: { hotelChainId: Number(hotelChainId) },
      update: { eliteStatusId: eliteStatusId ? Number(eliteStatusId) : null },
      create: {
        hotelChainId: Number(hotelChainId),
        eliteStatusId: eliteStatusId ? Number(eliteStatusId) : null,
      },
      include: {
        hotelChain: true,
        eliteStatus: true,
      },
    });

    // Only recalculate if the elite status changed
    if (!existing || existing.eliteStatusId !== status.eliteStatusId) {
      await recalculateLoyaltyForHotelChain(Number(hotelChainId));
    }

    return NextResponse.json(status);
  } catch (error) {
    return apiError("Failed to update user status", error);
  }
}
