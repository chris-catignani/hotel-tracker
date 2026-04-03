import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/earnings-tracker/route";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";

const mockBookingFindMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { findMany: mockBookingFindMany },
  },
}));

vi.mock("@/services/booking-enrichment", () => ({
  enrichBookingsWithPartnerships: vi.fn((bookings: unknown[]) =>
    Promise.resolve(bookings.map((b) => ({ ...(b as object), partnershipEarns: [] })))
  ),
}));

vi.mock("@/lib/net-cost", () => ({
  getNetCostBreakdown: vi.fn(() => ({ cardReward: 0, portalCashback: 0 })),
}));

function makeRequest(url = "http://localhost/api/earnings-tracker") {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/earnings-tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("fetches all bookings when no filter provided", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("applies needs-attention filter conditions", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    const res = await GET(
      makeRequest("http://localhost/api/earnings-tracker?filter=needs-attention")
    );
    expect(res.status).toBe(200);
    const where = mockBookingFindMany.mock.calls[0][0].where;
    expect(where.userId).toBe("user-1");
    expect(where.OR).toContainEqual({ loyaltyPostingStatus: "pending" });
    expect(where.OR).toContainEqual({ cardRewardPostingStatus: "pending" });
    expect(where.OR).toContainEqual({ portalCashbackPostingStatus: "pending" });
    expect(where.OR).toContainEqual({
      bookingPromotions: { some: { postingStatus: "pending", appliedValue: { gt: 0 } } },
    });
  });

  it("returns pre-computed cardReward and portalCashback on each booking", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    const { getNetCostBreakdown } = await import("@/lib/net-cost");
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 15,
      portalCashback: 8,
    } as never);
    mockBookingFindMany.mockResolvedValue([{ id: "b1" }]);

    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json[0]).toMatchObject({ id: "b1", cardReward: 15, portalCashback: 8 });
  });

  it("does not include heavyweight BOOKING_INCLUDE fields", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    await GET(makeRequest());
    const include = mockBookingFindMany.mock.calls[0][0].include;
    // hotelChain must NOT include userStatuses (that's in the heavy BOOKING_INCLUDE)
    expect(include.hotelChain?.include?.userStatuses).toBeUndefined();
    // hotelChainSubBrand must NOT be included
    expect(include.hotelChainSubBrand).toBeUndefined();
    // bookingPromotions must NOT include restrictions or tiers
    expect(include.bookingPromotions?.include?.promotion?.include?.restrictions).toBeUndefined();
    expect(include.bookingPromotions?.include?.promotion?.include?.tiers).toBeUndefined();
  });
});
