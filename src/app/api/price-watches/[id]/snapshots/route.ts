import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

/** GET /api/price-watches/[id]/snapshots — full price history */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const watch = await prisma.priceWatch.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!watch) return apiError("Price watch not found", null, 404, request, { priceWatchId: id });

    const snapshots = await prisma.priceSnapshot.findMany({
      where: { priceWatchId: id },
      orderBy: { fetchedAt: "desc" },
      include: { rooms: true },
    });

    return NextResponse.json(snapshots);
  } catch (error) {
    return apiError("Failed to fetch snapshots", error, 500, request, { priceWatchId: id });
  }
}
