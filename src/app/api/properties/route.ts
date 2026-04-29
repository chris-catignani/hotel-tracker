import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

/** GET /api/properties?hotelChainId=&name=&includeChain=&page=&limit= — search properties */
export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const { searchParams } = new URL(request.url);
    const hotelChainId = searchParams.get("hotelChainId");
    const name = searchParams.get("name");
    const includeChain = searchParams.get("includeChain") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where = {
      ...(hotelChainId ? { hotelChainId } : {}),
      ...(name ? { name: { contains: name, mode: "insensitive" } as const } : {}),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: includeChain ? { hotelChain: { select: { name: true } } } : undefined,
        orderBy: { name: "asc" },
        take: limit,
        skip,
      }),
      prisma.property.count({ where }),
    ]);

    return NextResponse.json({
      properties,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return apiError("Failed to fetch properties", error, 500, request);
  }
});
