import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { apiError } from "@/lib/api-error";

export const POST = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { partnershipEarnId, isEnabled } = await request.json();
    if (!partnershipEarnId || typeof isEnabled !== "boolean") {
      return NextResponse.json(
        { error: "partnershipEarnId and isEnabled are required" },
        { status: 400 }
      );
    }

    const record = await prisma.userPartnershipEarn.upsert({
      where: { userId_partnershipEarnId: { userId, partnershipEarnId } },
      update: { isEnabled },
      create: { userId, partnershipEarnId, isEnabled },
    });

    return NextResponse.json(record);
  } catch (error) {
    return apiError("Failed to update partnership earn preference", error, 500, request);
  }
});
