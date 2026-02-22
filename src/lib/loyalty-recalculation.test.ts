import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { recalculateLoyaltyForHotelChain } from "./loyalty-recalculation";
import prisma from "./prisma";
import { reevaluateBookings } from "./promotion-matching";

// Mock the dependencies
vi.mock("./prisma", () => ({
  default: {
    hotelChain: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock("./promotion-matching", () => ({
  reevaluateBookings: vi.fn(),
}));

const prismaMock = prisma as unknown as {
  hotelChain: { findUnique: Mock };
  booking: { findMany: Mock; update: Mock };
  $transaction: Mock;
};

describe("loyalty-recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should recalculate points and trigger promotion re-evaluation", async () => {
    // 1. Mock the hotel chain (Base rate: 10, Status bonus: 50%)
    const mockChain = {
      id: 1,
      basePointRate: 10,
      userStatus: {
        eliteStatus: {
          name: "Platinum",
          bonusPercentage: 0.5,
          isFixed: false,
          fixedRate: null,
        },
      },
    };
    prismaMock.hotelChain.findUnique.mockResolvedValue(mockChain);

    // 2. Mock future bookings
    const mockBookings = [
      { id: 101, pretaxCost: 100 }, // Expected: 1500
      { id: 102, pretaxCost: 200 }, // Expected: 3000
    ];
    prismaMock.booking.findMany.mockResolvedValue(mockBookings);

    // 3. Run the recalculation
    await recalculateLoyaltyForHotelChain(1);

    // 4. Verify transaction was called with updates
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.booking.update).toHaveBeenCalledTimes(2);

    // 5. Verify promotion re-evaluation
    expect(reevaluateBookings).toHaveBeenCalledWith([101, 102]);
  });

  it("should return early if chain not found", async () => {
    prismaMock.hotelChain.findUnique.mockResolvedValue(null);
    await recalculateLoyaltyForHotelChain(1);
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
  });

  it("should return early if no future bookings found", async () => {
    prismaMock.hotelChain.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.booking.findMany.mockResolvedValue([]);
    await recalculateLoyaltyForHotelChain(1);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
