import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/auth-utils";
import { normalizeUserStatuses } from "@/lib/normalize-response";

export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const hotelChains = await prisma.hotelChain.findMany({
      include: {
        pointType: true,
        hotelChainSubBrands: {
          orderBy: {
            name: "asc",
          },
        },
        eliteStatuses: {
          orderBy: {
            eliteTierLevel: "asc",
          },
        },
        userStatuses: {
          where: { userId },
          include: {
            eliteStatus: true,
          },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(normalizeUserStatuses(hotelChains));
  } catch (error) {
    return apiError("Failed to fetch hotel chains", error, 500, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const body = await request.json();
    const { name, loyaltyProgram, basePointRate, pointTypeId } = body;

    const hotelChain = await prisma.hotelChain.create({
      data: {
        name,
        loyaltyProgram,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
        pointTypeId: pointTypeId || null,
      },
      include: {
        pointType: true,
        eliteStatuses: { orderBy: { eliteTierLevel: "asc" } },
        userStatuses: {
          take: 0,
        },
      },
    });

    return NextResponse.json(normalizeUserStatuses(hotelChain), { status: 201 });
  } catch (error) {
    return apiError("Failed to create hotel chain", error, 500, request);
  }
}
