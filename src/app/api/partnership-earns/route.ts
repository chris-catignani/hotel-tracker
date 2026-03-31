import { NextRequest, NextResponse } from "next/server";
import { withObservability as withAxiom } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { apiError } from "@/lib/api-error";

export const GET = withAxiom(async (_request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const [earns, userEarns] = await Promise.all([
      prisma.partnershipEarn.findMany({
        where: { isActive: true },
        include: { pointType: true },
        orderBy: { name: "asc" },
      }),
      prisma.userPartnershipEarn.findMany({
        where: { userId },
        select: { partnershipEarnId: true, isEnabled: true },
      }),
    ]);

    const enabledMap = new Map(userEarns.map((e) => [e.partnershipEarnId, e.isEnabled]));

    const result = earns.map((earn) => ({
      id: earn.id,
      name: earn.name,
      earnRate: earn.earnRate,
      earnCurrency: earn.earnCurrency,
      pointType: earn.pointType,
      isEnabled: enabledMap.get(earn.id) ?? false,
    }));

    return NextResponse.json(result);
  } catch (error) {
    return apiError("Failed to fetch partnership earns", error, 500);
  }
});
