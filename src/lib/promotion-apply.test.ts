import { describe, it, expect, vi, type Mock } from "vitest";
import prisma from "./prisma";
import { reevaluateSubsequentBookings, getSubsequentBookingIds } from "./promotion-apply";

vi.mock("./prisma", () => ({
  default: {
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    promotion: {
      findMany: vi.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  booking: {
    findUnique: Mock;
    findMany: Mock;
  };
  promotion: {
    findMany: Mock;
  };
};

describe("cascading-reevaluation", () => {
  it("should re-evaluate only relevant subsequent bookings when promotionIds are provided", async () => {
    const bookingId = "b1";
    const promoIds = ["p1"];
    const checkIn = new Date("2026-01-01");

    prismaMock.booking.findUnique.mockResolvedValueOnce({ id: bookingId, checkIn });
    // First findMany call: reevaluateSubsequentBookings finds subsequent bookings
    prismaMock.booking.findMany.mockResolvedValueOnce([{ id: "b2" }, { id: "b3" }]);
    // Second findMany call: reevaluateBookings fetches bookings by id (returns [] → no-op loop)
    prismaMock.booking.findMany.mockResolvedValueOnce([]);
    prismaMock.promotion.findMany.mockResolvedValue([]);

    await reevaluateSubsequentBookings(bookingId, promoIds);

    // Verify the cascade query used the right filter
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkIn: { gt: checkIn },
          bookingPromotions: { some: { promotionId: { in: promoIds } } },
        }),
      })
    );

    // Verify reevaluateBookings was called with the found IDs (inferred from the second findMany)
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["b2", "b3"] } },
      })
    );
  });

  it("should re-evaluate all subsequent bookings when no promotionIds are provided", async () => {
    const bookingId = "b1";
    const checkIn = new Date("2026-01-01");

    prismaMock.booking.findUnique.mockResolvedValueOnce({ id: bookingId, checkIn });
    prismaMock.booking.findMany
      .mockResolvedValueOnce([{ id: "b2" }, { id: "b3" }, { id: "b4" }])
      .mockResolvedValueOnce([]);
    prismaMock.promotion.findMany.mockResolvedValue([]);

    await reevaluateSubsequentBookings(bookingId);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkIn: { gt: checkIn },
        }),
      })
    );

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["b2", "b3", "b4"] } },
      })
    );
  });

  it("should use getSubsequentBookingIds correctly", async () => {
    const checkIn = new Date("2026-01-01");
    prismaMock.booking.findMany.mockResolvedValueOnce([{ id: "b2" }]);

    const ids = await getSubsequentBookingIds(checkIn);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { checkIn: { gt: checkIn } },
      })
    );
    expect(ids).toEqual(["b2"]);
  });
});
