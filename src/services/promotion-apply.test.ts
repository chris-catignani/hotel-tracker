import { describe, it, expect, vi, type Mock } from "vitest";
import prisma from "@/lib/prisma";
import { calculateMatchedPromotions } from "@/lib/promotion-matching";
import { getCurrentRate, resolveCalcCurrencyRate } from "./exchange-rate";
import {
  reevaluateSubsequentBookings,
  getSubsequentBookingIds,
  reevaluateBookings,
  matchPromotionsForBooking,
  getAffectedBookingIds,
} from "./promotion-apply";

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    promotion: {
      findMany: vi.fn(),
    },
    bookingPromotion: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("./promotion-usage", () => ({
  fetchPromotionUsage: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/lib/promotion-matching", () => ({
  calculateMatchedPromotions: vi.fn().mockReturnValue([]),
  getConstrainedPromotions: vi.fn().mockReturnValue([]),
  BOOKING_INCLUDE: {},
  PROMOTIONS_INCLUDE: {},
}));

vi.mock("./exchange-rate", () => ({
  getCurrentRate: vi.fn().mockResolvedValue(1),
  resolveCalcCurrencyRate: vi.fn().mockResolvedValue(null),
}));

const prismaMock = prisma as unknown as {
  booking: {
    findUnique: Mock;
    findFirst: Mock;
    findMany: Mock;
  };
  promotion: {
    findMany: Mock;
  };
  bookingPromotion: {
    findMany: Mock;
    deleteMany: Mock;
    create: Mock;
  };
  $transaction: Mock;
};

describe("cascading-reevaluation", () => {
  it("should re-evaluate only relevant subsequent bookings when promotionIds are provided", async () => {
    const bookingId = "b1";
    const userId = "user1";
    const promoIds = ["p1"];
    const checkIn = new Date("2026-01-01");

    prismaMock.booking.findUnique.mockResolvedValueOnce({ id: bookingId, checkIn });
    prismaMock.booking.findMany.mockResolvedValueOnce([{ id: "b2" }, { id: "b3" }]);
    prismaMock.booking.findMany.mockResolvedValueOnce([]);
    prismaMock.promotion.findMany.mockResolvedValue([]);

    await reevaluateSubsequentBookings(bookingId, userId, promoIds);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          checkIn: { gt: checkIn },
          bookingPromotions: { some: { promotionId: { in: promoIds } } },
        }),
      })
    );

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["b2", "b3"] }, userId },
      })
    );
  });

  it("should re-evaluate all subsequent bookings when no promotionIds are provided", async () => {
    const bookingId = "b1";
    const userId = "user1";
    const checkIn = new Date("2026-01-01");

    prismaMock.booking.findUnique.mockResolvedValueOnce({ id: bookingId, checkIn });
    prismaMock.booking.findMany
      .mockResolvedValueOnce([{ id: "b2" }, { id: "b3" }, { id: "b4" }])
      .mockResolvedValueOnce([]);
    prismaMock.promotion.findMany.mockResolvedValue([]);

    await reevaluateSubsequentBookings(bookingId, userId);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          checkIn: { gt: checkIn },
        }),
      })
    );

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["b2", "b3", "b4"] }, userId },
      })
    );
  });

  it("should use getSubsequentBookingIds with userId correctly", async () => {
    const checkIn = new Date("2026-01-01");
    const userId = "user1";
    prismaMock.booking.findMany.mockResolvedValueOnce([{ id: "b2" }]);

    const ids = await getSubsequentBookingIds(checkIn, userId);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, checkIn: { gt: checkIn } },
      })
    );
    expect(ids).toEqual(["b2"]);
  });
});

describe("reevaluateBookings-userId-scoping", () => {
  it("should scope promotion.findMany to userId", async () => {
    const userId = "user1";
    prismaMock.promotion.findMany.mockResolvedValueOnce([]);
    prismaMock.booking.findMany.mockResolvedValueOnce([]);

    await reevaluateBookings(["b1"], userId);

    expect(prismaMock.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
      })
    );
  });

  it("should scope booking.findMany to userId", async () => {
    const userId = "user1";
    prismaMock.promotion.findMany.mockResolvedValueOnce([]);
    prismaMock.booking.findMany.mockResolvedValueOnce([]);

    await reevaluateBookings(["b1", "b2"], userId);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["b1", "b2"] }, userId },
      })
    );
  });
});

describe("matchPromotionsForBooking-userId-scoping", () => {
  it("should scope booking lookup to userId via findFirst", async () => {
    const userId = "user1";
    prismaMock.booking.findFirst.mockResolvedValueOnce(null);

    await expect(matchPromotionsForBooking("b1", userId)).rejects.toThrow("not found");

    expect(prismaMock.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1", userId },
      })
    );
  });

  it("should scope promotion.findMany to userId", async () => {
    const userId = "user1";
    prismaMock.booking.findFirst.mockResolvedValueOnce({
      id: "b1",
      userId,
      currency: "USD",
      checkIn: new Date("2026-06-01"),
      lockedExchangeRate: null,
    });
    prismaMock.promotion.findMany.mockResolvedValueOnce([]);

    await matchPromotionsForBooking("b1", userId);

    expect(prismaMock.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
      })
    );
  });
});

describe("getAffectedBookingIds-userId-scoping", () => {
  it("should scope booking.findMany to userId", async () => {
    const userId = "user1";
    prismaMock.promotion.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        hotelChainId: "hc1",
        creditCardId: null,
        shoppingPortalId: null,
        startDate: null,
        endDate: null,
      },
    ]);
    prismaMock.booking.findMany.mockResolvedValueOnce([]);

    await getAffectedBookingIds(["p1"], userId);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId }),
      })
    );
  });
});

describe("reevaluateBookings-exchange-rate-resolution", () => {
  it("resolves exchange rate for future non-USD booking with null lockedExchangeRate", async () => {
    const userId = "user1";
    const booking = {
      id: "b1",
      currency: "NZD",
      lockedExchangeRate: null,
      checkIn: new Date("2027-01-01"),
      hotelChain: null,
    };
    vi.mocked(getCurrentRate).mockResolvedValueOnce(0.592);
    prismaMock.promotion.findMany.mockResolvedValueOnce([]);
    prismaMock.booking.findMany.mockResolvedValueOnce([booking]);
    prismaMock.booking.findUnique.mockResolvedValueOnce(null);

    await reevaluateBookings(["b1"], userId);

    expect(calculateMatchedPromotions).toHaveBeenCalledWith(
      expect.objectContaining({ lockedExchangeRate: 0.592 }),
      expect.anything(),
      expect.anything()
    );
  });

  it("resolves calcCurrencyToUsdRate for non-USD hotel chain and passes it in booking", async () => {
    const userId = "user1";
    const booking = {
      id: "b1",
      currency: "USD",
      lockedExchangeRate: null,
      checkIn: new Date("2027-01-01"),
      hotelChain: { calculationCurrency: "EUR", basePointRate: 2.5, pointType: null },
    };
    vi.mocked(resolveCalcCurrencyRate).mockResolvedValueOnce(1.25);
    prismaMock.promotion.findMany.mockResolvedValueOnce([]);
    prismaMock.booking.findMany.mockResolvedValueOnce([booking]);
    prismaMock.booking.findUnique.mockResolvedValueOnce(null);

    await reevaluateBookings(["b1"], userId);

    expect(calculateMatchedPromotions).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelChain: expect.objectContaining({ calcCurrencyToUsdRate: 1.25 }),
      }),
      expect.anything(),
      expect.anything()
    );
  });
});

describe("applyMatchedPromotions-preserves-posting-status", () => {
  const userId = "user1";
  const bookingId = "b1";

  const makeMatch = (promotionId: string) => ({
    promotionId,
    appliedValue: 50,
    bonusPointsApplied: 0,
    eligibleNightsAtBooking: null,
    isOrphaned: false,
    isPreQualifying: false,
    benefitApplications: [],
  });

  it("should restore postingStatus from an existing record when the promotion still matches", async () => {
    // PromoA was posted; after re-eval it still matches — status must be preserved
    (calculateMatchedPromotions as Mock).mockReturnValueOnce([makeMatch("p1")]);
    prismaMock.promotion.findMany.mockResolvedValueOnce([]);
    prismaMock.booking.findMany.mockResolvedValueOnce([{ id: bookingId, checkIn: new Date() }]);
    prismaMock.booking.findUnique.mockResolvedValueOnce({ id: bookingId });
    prismaMock.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma)
    );
    prismaMock.bookingPromotion.findMany.mockResolvedValueOnce([
      { promotionId: "p1", postingStatus: "posted" },
      { promotionId: "p2", postingStatus: "pending" },
    ]);
    prismaMock.bookingPromotion.deleteMany.mockResolvedValueOnce({});
    prismaMock.bookingPromotion.create.mockResolvedValueOnce({ id: "bp1" });

    await reevaluateBookings([bookingId], userId);

    expect(prismaMock.bookingPromotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promotionId: "p1",
          postingStatus: "posted",
        }),
      })
    );
  });

  it("should default to pending for a promotion with no prior posting status", async () => {
    // PromoC is newly matched — no prior record, must default to pending
    (calculateMatchedPromotions as Mock).mockReturnValueOnce([makeMatch("p-new")]);
    prismaMock.promotion.findMany.mockResolvedValueOnce([]);
    prismaMock.booking.findMany.mockResolvedValueOnce([{ id: bookingId, checkIn: new Date() }]);
    prismaMock.booking.findUnique.mockResolvedValueOnce({ id: bookingId });
    prismaMock.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma)
    );
    prismaMock.bookingPromotion.findMany.mockResolvedValueOnce([
      { promotionId: "p1", postingStatus: "posted" },
    ]);
    prismaMock.bookingPromotion.deleteMany.mockResolvedValueOnce({});
    prismaMock.bookingPromotion.create.mockResolvedValueOnce({ id: "bp2" });

    await reevaluateBookings([bookingId], userId);

    expect(prismaMock.bookingPromotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promotionId: "p-new",
          postingStatus: "pending",
        }),
      })
    );
  });
});
