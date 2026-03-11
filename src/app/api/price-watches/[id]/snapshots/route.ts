import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

/** GET /api/price-watches/[id]/snapshots — full price history */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const watch = await prisma.priceWatch.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!watch) return apiError("Price watch not found", null, 404, request);

    const snapshots = await prisma.priceSnapshot.findMany({
      where: { priceWatchId: id },
      orderBy: { fetchedAt: "desc" },
    });

    return NextResponse.json(snapshots);
  } catch (error) {
    return apiError("Failed to fetch snapshots", error, 500, request);
  }
}
