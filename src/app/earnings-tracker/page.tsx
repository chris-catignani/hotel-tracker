import { EarningsTrackerGrid } from "@/components/earnings-tracker/earnings-tracker-grid";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { enrichBookingsWithPartnerships } from "@/services/booking-enrichment";
import { getNetCostBreakdown } from "@/lib/net-cost";

async function getBookings(filter: string) {
  const userIdOrResponse = await getAuthenticatedUserId();
  if (typeof userIdOrResponse !== "string") redirect("/auth/signin");
  const userId = userIdOrResponse;

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
            { bookingPartnershipEarnStatuses: { some: { postingStatus: "pending" as const } } },
          ],
        }
      : { userId };

  const bookings = await prisma.booking.findMany({
    where,
    include: {
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
    },
    orderBy: { checkIn: "asc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = await enrichBookingsWithPartnerships(bookings as any[], userId);

  return enriched.map((b) => {
    const { cardReward, portalCashback } = getNetCostBreakdown({
      ...b,
      certificates: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return { ...b, cardReward, portalCashback };
  });
}

export default async function EarningsTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "needs-attention" } = await searchParams;
  const bookings = await getBookings(filter);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Earnings Tracker</h1>
        <div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">
          <a
            href="/earnings-tracker?filter=needs-attention"
            data-testid="earnings-filter-needs-attention"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === "needs-attention" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Needs Attention
          </a>
          <a
            href="/earnings-tracker?filter=all"
            data-testid="earnings-filter-all"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === "all" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            All Bookings
          </a>
        </div>
      </div>
      <EarningsTrackerGrid initialBookings={JSON.parse(JSON.stringify(bookings))} />
    </div>
  );
}
