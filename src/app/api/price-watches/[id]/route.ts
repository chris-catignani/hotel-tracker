import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

const PRICE_WATCH_INCLUDE = {
  property: true,
  bookings: {
    include: {
      booking: {
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          numNights: true,
          totalCost: true,
          currency: true,
          hotelChain: { select: { name: true } },
        },
      },
    },
  },
  snapshots: {
    orderBy: { fetchedAt: "desc" as const },
    take: 5,
    include: {
      rooms: {
        orderBy: [{ roomName: "asc" }, { ratePlanName: "asc" }] as {
          roomName?: "asc" | "desc";
          ratePlanName?: "asc" | "desc";
        }[],
      },
    },
  },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const watch = await prisma.priceWatch.findFirst({
      where: { id, userId },
      include: PRICE_WATCH_INCLUDE,
    });

    if (!watch) return apiError("Price watch not found", null, 404, request);
    return NextResponse.json(watch);
  } catch (error) {
    return apiError("Failed to fetch price watch", error, 500, request);
  }
}

/** PUT /api/price-watches/[id] — toggle isEnabled */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const exists = await prisma.priceWatch.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!exists) return apiError("Price watch not found", null, 404, request);

    const body = await request.json();
    const { isEnabled } = body;

    const watch = await prisma.priceWatch.update({
      where: { id },
      data: { isEnabled },
      include: PRICE_WATCH_INCLUDE,
    });

    return NextResponse.json(watch);
  } catch (error) {
    return apiError("Failed to update price watch", error, 500, request);
  }
}

/** DELETE /api/price-watches/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const exists = await prisma.priceWatch.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!exists) return apiError("Price watch not found", null, 404, request);

    await prisma.priceWatch.delete({ where: { id } });
    return NextResponse.json({ message: "Price watch deleted" });
  } catch (error) {
    return apiError("Failed to delete price watch", error, 500, request);
  }
}
