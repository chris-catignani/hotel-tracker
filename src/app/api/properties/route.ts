import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

/** GET /api/properties?hotelChainId=&name= — search properties */
export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const { searchParams } = new URL(request.url);
    const hotelChainId = searchParams.get("hotelChainId");
    const name = searchParams.get("name");

    const properties = await prisma.property.findMany({
      where: {
        ...(hotelChainId ? { hotelChainId } : {}),
        ...(name ? { name: { contains: name, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(properties);
  } catch (error) {
    return apiError("Failed to fetch properties", error, 500, request);
  }
}
