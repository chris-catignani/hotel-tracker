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
      where: { hotelChainId: hotelChainId },
      select: { eliteStatusId: true },
    });

    // Validate that eliteStatusId belongs to hotelChainId
    if (eliteStatusId) {
      const eliteStatus = await prisma.hotelChainEliteStatus.findUnique({
        where: { id: eliteStatusId },
      });
      if (!eliteStatus || eliteStatus.hotelChainId !== hotelChainId) {
        return NextResponse.json(
          { error: "Elite status does not belong to the specified hotel chain" },
          { status: 400 }
        );
      }
    }

    const status = await prisma.userStatus.upsert({
      where: { hotelChainId: hotelChainId },
      update: { eliteStatusId: eliteStatusId ? eliteStatusId : null },
      create: {
        hotelChainId: hotelChainId,
        eliteStatusId: eliteStatusId ? eliteStatusId : null,
      },
      include: {
        hotelChain: true,
        eliteStatus: true,
      },
    });

    // Only recalculate if the elite status changed
    if (!existing || existing.eliteStatusId !== status.eliteStatusId) {
      await recalculateLoyaltyForHotelChain(hotelChainId);
    }

    return NextResponse.json(status);
  } catch (error) {
    return apiError("Failed to update user status", error);
  }
}
