import { NextRequest, NextResponse } from "next/server";
import { withAxiom } from "next-axiom";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

/** GET /api/properties?hotelChainId=&name=&includeChain= — search properties */
export const GET = withAxiom(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const { searchParams } = new URL(request.url);
    const hotelChainId = searchParams.get("hotelChainId");
    const name = searchParams.get("name");
    const includeChain = searchParams.get("includeChain") === "true";

    const properties = await prisma.property.findMany({
      where: {
        ...(hotelChainId ? { hotelChainId } : {}),
        ...(name ? { name: { contains: name, mode: "insensitive" } } : {}),
      },
      include: includeChain ? { hotelChain: { select: { name: true } } } : undefined,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(properties);
  } catch (error) {
    return apiError("Failed to fetch properties", error, 500, request);
  }
});
