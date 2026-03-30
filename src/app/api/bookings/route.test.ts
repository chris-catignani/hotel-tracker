import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/bookings/route";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";

const mockBookingFindMany = vi.hoisted(() => vi.fn());
const mockUserPartnershipEarnFindMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      findMany: mockBookingFindMany,
    },
    userPartnershipEarn: {
      findMany: mockUserPartnershipEarnFindMany,
    },
  },
}));

vi.mock("@/lib/normalize-response", () => ({
  normalizeUserStatuses: vi.fn((x) => (Array.isArray(x) ? x : x)),
}));

vi.mock("@/lib/booking-enrichment", () => ({
  enrichBookingWithRate: vi.fn((b) => Promise.resolve(b)),
}));

vi.mock("@/lib/partnership-earns", () => ({
  resolvePartnershipEarns: vi.fn(() => Promise.resolve([])),
}));

function makeRequest(url = "http://localhost/api/bookings") {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingFindMany.mockResolvedValue([]);
    mockUserPartnershipEarnFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("fetches all bookings for the user when no filter is provided", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      })
    );
  });

  it("applies OR conditions when filter=needs-attention", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);

    const res = await GET(makeRequest("http://localhost/api/bookings?filter=needs-attention"));
    expect(res.status).toBe(200);

    const callArgs = mockBookingFindMany.mock.calls[0][0];
    const where = callArgs.where;

    expect(where.userId).toBe("user-1");
    expect(where.OR).toBeDefined();
    expect(where.OR).toContainEqual({ loyaltyPostingStatus: "pending" });
    expect(where.OR).toContainEqual({ cardRewardPostingStatus: "pending" });
    expect(where.OR).toContainEqual({ portalCashbackPostingStatus: "pending" });
    expect(where.OR).toContainEqual({
      bookingPromotions: { some: { postingStatus: "pending" } },
    });
    expect(where.OR).toContainEqual({
      bookingCardBenefits: { some: { postingStatus: "pending" } },
    });
    expect(where.OR).toContainEqual({
      benefits: { some: { postingStatus: "pending" } },
    });
    expect(where.OR).toContainEqual({
      bookingPartnershipEarnStatuses: { some: { postingStatus: "pending" } },
    });
    // Also includes future check-in condition
    const futureCheckIn = where.OR.find((c: Record<string, unknown>) => "checkIn" in c);
    expect(futureCheckIn).toBeDefined();
    expect(futureCheckIn.checkIn).toHaveProperty("gte");
  });
});
