import { PostingStatusGrid } from "@/components/posting-status/posting-status-grid";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import { enrichBookingWithRate } from "@/lib/booking-enrichment";
import { resolvePartnershipEarns, PartnershipEarnInput } from "@/lib/partnership-earns";
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

  const normalized = normalizeUserStatuses(bookings) as (typeof bookings)[number][];
  const enriched = await Promise.all(normalized.map(enrichBookingWithRate));

  const enabledEarns = await prisma.userPartnershipEarn.findMany({
    where: { userId, isEnabled: true },
    include: { partnershipEarn: { include: { pointType: true } } },
  });

  const earnInputs: PartnershipEarnInput[] = enabledEarns.map((e) => ({
    ...e.partnershipEarn,
    earnRate: Number(e.partnershipEarn.earnRate),
    pointType: {
      ...e.partnershipEarn.pointType,
      usdCentsPerPoint: Number(e.partnershipEarn.pointType.usdCentsPerPoint),
    },
  }));

  return Promise.all(
    enriched.map(async (b) => {
      const results = await resolvePartnershipEarns(
        {
          hotelChainId: b.hotelChainId,
          pretaxCost: Number(b.pretaxCost),
          lockedExchangeRate: b.lockedExchangeRate ? Number(b.lockedExchangeRate) : null,
          property: b.property,
          checkIn: b.checkIn,
        },
        earnInputs
      );
      const partnershipEarns = results.map((r) => ({
        id: r.id,
        name: r.name,
        pointsEarned: r.pointsEarned,
        earnedValue: r.earnedValue,
        pointTypeName: r.pointTypeName,
      }));
      const { cardReward, portalCashback } = getNetCostBreakdown({
        ...b,
        partnershipEarns,
        certificates: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return { ...b, partnershipEarns, cardReward, portalCashback };
    })
  );
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
