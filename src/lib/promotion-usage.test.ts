import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import prisma from "./prisma";
import { fetchPromotionUsage } from "./promotion-usage";
import type { MatchingPromotion, MatchingBooking } from "./promotion-matching";

vi.mock("./prisma", () => ({
  default: {
    bookingPromotion: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    bookingPromotionBenefit: {
      groupBy: vi.fn(),
    },
    booking: {
      aggregate: vi.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  bookingPromotion: { groupBy: Mock; findMany: Mock };
  bookingPromotionBenefit: { groupBy: Mock };
  booking: { aggregate: Mock };
};

function makePromotion(id: string, overrides: Partial<MatchingPromotion> = {}): MatchingPromotion {
  return {
    id,
    type: "loyalty",
    hotelChainId: "hc1",
    creditCardId: null,
    shoppingPortalId: null,
    startDate: null,
    endDate: null,
    registrationDate: null,
    restrictions: null,
    benefits: [],
    tiers: [],
    ...overrides,
  } as unknown as MatchingPromotion;
}

function makeBooking(overrides: Partial<MatchingBooking> = {}): MatchingBooking {
  return {
    id: "bk1",
    userId: "user1",
    checkIn: new Date("2026-06-15"),
    numNights: 3,
    hotelChainId: "hc1",
    ...overrides,
  } as unknown as MatchingBooking;
}

describe("fetchPromotionUsage userId scoping", () => {
  beforeEach(() => {
    prismaMock.bookingPromotion.groupBy.mockResolvedValue([]);
    prismaMock.bookingPromotionBenefit.groupBy.mockResolvedValue([]);
    prismaMock.bookingPromotion.findMany.mockResolvedValue([]);
    prismaMock.booking.aggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { numNights: 0 } });
  });

  it("should scope bookingPromotion.groupBy to userId", async () => {
    const userId = "user1";
    const promos = [makePromotion("p1")];
    const booking = makeBooking();

    await fetchPromotionUsage(promos, booking, userId);

    expect(prismaMock.bookingPromotion.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          booking: expect.objectContaining({ userId }),
        }),
      })
    );
  });

  it("should scope booking.aggregate (potential stats) to userId", async () => {
    const userId = "user1";
    const promos = [makePromotion("p1")];
    const booking = makeBooking();

    await fetchPromotionUsage(promos, booking, userId);

    // booking.aggregate is called for potential stats — check userId is in where
    expect(prismaMock.booking.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId }),
      })
    );
  });

  it("should scope bookingPromotion.findMany (spanStays) to userId", async () => {
    const userId = "user1";
    const promos = [
      makePromotion("p1", {
        restrictions: { spanStays: true } as unknown as MatchingPromotion["restrictions"],
        benefits: [],
        tiers: [],
      }),
    ];
    const booking = makeBooking();

    await fetchPromotionUsage(promos, booking, userId);

    // The spanStays bookingPromotion.findMany should be scoped
    const calls = prismaMock.bookingPromotion.findMany.mock.calls;
    const hasUserIdScope = calls.some((call: unknown[]) => {
      const args = call[0] as { where?: { booking?: { userId?: string } } };
      return args.where?.booking?.userId === userId;
    });
    expect(hasUserIdScope).toBe(true);
  });
});
