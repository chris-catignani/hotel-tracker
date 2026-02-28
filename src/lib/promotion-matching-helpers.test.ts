import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import prisma from "./prisma";
import {
  reevaluateSubsequentBookings,
  getSubsequentBookingIds,
} from "./promotion-matching-helpers";
import { reevaluateBookings } from "./promotion-matching";

// Mock prisma
vi.mock("./prisma", () => ({
  default: {
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock reevaluateBookings from promotion-matching
vi.mock("./promotion-matching", () => ({
  reevaluateBookings: vi.fn().mockResolvedValue(undefined),
}));

const prismaMock = prisma as unknown as {
  booking: {
    findUnique: Mock;
    findMany: Mock;
  };
};

describe("cascading-reevaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should re-evaluate only relevant subsequent bookings when promotionIds are provided", async () => {
    const bookingId = "b1";
    const promoIds = ["p1"];
    const checkIn = new Date("2026-01-01");

    prismaMock.booking.findUnique.mockResolvedValue({ id: bookingId, checkIn });
    prismaMock.booking.findMany.mockResolvedValue([{ id: "b2" }, { id: "b3" }]);

    await reevaluateSubsequentBookings(bookingId, promoIds);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkIn: { gt: checkIn },
          bookingPromotions: { some: { promotionId: { in: promoIds } } },
        }),
      })
    );

    expect(reevaluateBookings).toHaveBeenCalledWith(["b2", "b3"]);
  });

  it("should re-evaluate all subsequent bookings when no promotionIds are provided", async () => {
    const bookingId = "b1";
    const checkIn = new Date("2026-01-01");

    prismaMock.booking.findUnique.mockResolvedValue({ id: bookingId, checkIn });
    prismaMock.booking.findMany.mockResolvedValue([{ id: "b2" }, { id: "b3" }, { id: "b4" }]);

    await reevaluateSubsequentBookings(bookingId);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkIn: { gt: checkIn },
        }),
      })
    );

    expect(reevaluateBookings).toHaveBeenCalledWith(["b2", "b3", "b4"]);
  });

  it("should use getSubsequentBookingIds correctly", async () => {
    const checkIn = new Date("2026-01-01");
    prismaMock.booking.findMany.mockResolvedValue([{ id: "b2" }]);

    const ids = await getSubsequentBookingIds(checkIn);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { checkIn: { gt: checkIn } },
      })
    );
    expect(ids).toEqual(["b2"]);
  });
});
