import { describe, it, expect, vi, type Mock } from "vitest";
import prisma from "@/lib/prisma";
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
