import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { enrichBookingsWithPartnerships } from "@/services/booking-enrichment";
import { getNetCostBreakdown } from "@/lib/net-cost";

const EARNINGS_TRACKER_INCLUDE = {
  property: true,
  hotelChain: { include: { pointType: true } },
  userCreditCard: {
    include: { creditCard: { include: { pointType: true, rewardRules: true } } },
  },
  shoppingPortal: { include: { pointType: true } },
  bookingPromotions: { include: { promotion: { include: { benefits: true } } } },
  bookingCardBenefits: { include: { cardBenefit: true } },
  benefits: true,
  bookingPartnershipEarnStatuses: true,
} as const;

export const GET = withObservability(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where =
      filter === "needs-attention"
        ? {
            userId,
            OR: [
              {
                checkIn: { gte: today },
                OR: [
                  { loyaltyPostingStatus: { not: null } },
                  { cardRewardPostingStatus: { not: null } },
                  { portalCashbackPostingStatus: { not: null } },
                  { bookingPromotions: { some: {} } },
                  { bookingCardBenefits: { some: {} } },
                  { benefits: { some: {} } },
                  { bookingPartnershipEarnStatuses: { some: {} } },
                ],
              },
              { loyaltyPostingStatus: "pending" as const },
              { cardRewardPostingStatus: "pending" as const },
              { portalCashbackPostingStatus: "pending" as const },
              {
                bookingPromotions: {
                  some: { postingStatus: "pending" as const, appliedValue: { gt: 0 } },
                },
              },
              { bookingCardBenefits: { some: { postingStatus: "pending" as const } } },
              { benefits: { some: { postingStatus: "pending" as const } } },
              {
                bookingPartnershipEarnStatuses: {
                  some: { postingStatus: "pending" as const },
                },
              },
            ],
          }
        : { userId };

    const bookings = await prisma.booking.findMany({
      where,
      include: EARNINGS_TRACKER_INCLUDE,
      orderBy: { checkIn: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = await enrichBookingsWithPartnerships(bookings as any[], userId);

    const result = enriched.map((b) => {
      const { cardReward, portalCashback } = getNetCostBreakdown({
        ...b,
        certificates: [], // not fetched by this endpoint; cardReward/portalCashback don't depend on certs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return { ...b, cardReward, portalCashback };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, request);
    return apiError("Failed to fetch earnings tracker data", error, 500, request);
  }
});
