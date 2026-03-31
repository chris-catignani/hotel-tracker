import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const rates = await prisma.exchangeRate.findMany({
      orderBy: { fromCurrency: "asc" },
    });

    return NextResponse.json(rates);
  } catch (error) {
    return apiError("Failed to fetch exchange rates", error, 500, request);
  }
});
