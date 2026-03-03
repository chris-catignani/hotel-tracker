import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import prisma from "./prisma";
import { reevaluateRelatedBookings } from "./promotion-matching-helpers";
import { reevaluateBookings, getAffectedBookingIds } from "./promotion-matching";

// Mock prisma
vi.mock("./prisma", () => ({
  default: {
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock promotion-matching functions
vi.mock("./promotion-matching", () => ({
  reevaluateBookings: vi.fn().mockResolvedValue(undefined),
  getAffectedBookingIds: vi.fn().mockResolvedValue([]),
}));

const prismaMock = prisma as unknown as {
  booking: {
    findUnique: Mock;
    findMany: Mock;
  };
};

describe("promotion-matching-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should re-evaluate related and subsequent bookings when params are provided", async () => {
    const bookingId = "b1";
    const promoIds = ["p1"];
    const checkIn = new Date("2026-01-01");
    const affectedIds = ["b2"];

    (getAffectedBookingIds as Mock).mockResolvedValue(affectedIds);
    prismaMock.booking.findMany.mockResolvedValue([{ id: "b1" }, { id: "b2" }, { id: "b3" }]);

    await reevaluateRelatedBookings(bookingId, promoIds, checkIn);

    expect(getAffectedBookingIds).toHaveBeenCalledWith(promoIds);

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ id: bookingId }, { id: { in: affectedIds } }, { checkIn: { gt: checkIn } }],
        }),
      })
    );

    expect(reevaluateBookings).toHaveBeenCalledWith(["b1", "b2", "b3"]);
  });

  it("should not re-evaluate if no params are provided", async () => {
    await reevaluateRelatedBookings(null, []);
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
    expect(reevaluateBookings).not.toHaveBeenCalled();
  });
});
