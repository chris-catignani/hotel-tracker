import { PostingStatusGrid } from "@/components/posting-status/posting-status-grid";
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
            { bookingPromotions: { some: { postingStatus: "pending" as const } } },
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

export default async function PostingStatusPage({
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
        <div className="flex gap-2">
          <a
            href="/posting-status?filter=needs-attention"
            className={`rounded-full px-3 py-1 text-sm font-medium ${filter === "needs-attention" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Needs Attention
          </a>
          <a
            href="/posting-status?filter=all"
            className={`rounded-full px-3 py-1 text-sm font-medium ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            All Bookings
          </a>
        </div>
      </div>
      <PostingStatusGrid initialBookings={JSON.parse(JSON.stringify(bookings))} />
    </div>
  );
}
