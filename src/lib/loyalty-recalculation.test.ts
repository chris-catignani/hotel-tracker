import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { recalculateLoyaltyForHotelChain } from "./loyalty-recalculation";
import prisma from "./prisma";
import { reevaluateBookings } from "./promotion-matching";
import { resolveCalcCurrencyRate } from "./exchange-rate";

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

vi.mock("./exchange-rate", () => ({
  getCurrentRate: vi.fn().mockResolvedValue(1),
  fetchExchangeRate: vi.fn().mockResolvedValue(1),
  resolveCalcCurrencyRate: vi.fn().mockResolvedValue(null),
}));

const prismaMock = prisma as unknown as {
  hotelChain: { findUnique: Mock };
  booking: { findMany: Mock; update: Mock };
  $transaction: Mock;
};
const resolveCalcCurrencyRateMock = resolveCalcCurrencyRate as unknown as Mock;

describe("loyalty-recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should recalculate points and trigger promotion re-evaluation", async () => {
    // 1. Mock the hotel chain (Base rate: 10, Status bonus: 50%)
    const mockChain = {
      id: "1",
      basePointRate: 10,
      userStatuses: [
        {
          eliteStatus: {
            name: "Platinum",
            bonusPercentage: 0.5,
            isFixed: false,
            fixedRate: null,
          },
        },
      ],
    };
    prismaMock.hotelChain.findUnique.mockResolvedValue(mockChain);

    // 2. Mock past bookings (USD, exchangeRate = 1)
    const mockBookings = [
      { id: "101", pretaxCost: 100, currency: "USD", exchangeRate: 1 }, // Expected: 1500
      { id: "102", pretaxCost: 200, currency: "USD", exchangeRate: 1 }, // Expected: 3000
    ];
    prismaMock.booking.findMany.mockResolvedValue(mockBookings);

    // 3. Run the recalculation
    await recalculateLoyaltyForHotelChain("1", "user-1");

    // 4. Verify transaction was called with updates
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.booking.update).toHaveBeenCalledTimes(2);

    // 5. Verify promotion re-evaluation
    expect(reevaluateBookings).toHaveBeenCalledWith(["101", "102"]);
  });

  it("should return early if chain not found", async () => {
    prismaMock.hotelChain.findUnique.mockResolvedValue(null);
    await recalculateLoyaltyForHotelChain("1", "user-1");
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
  });

  it("should return early if no future bookings found", async () => {
    prismaMock.hotelChain.findUnique.mockResolvedValue({ id: "1", userStatuses: [] });
    prismaMock.booking.findMany.mockResolvedValue([]);
    await recalculateLoyaltyForHotelChain("1", "user-1");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("should convert to calc currency (EUR) when chain has calculationCurrency", async () => {
    // Accor-like chain: 2.5 pts/€, calculationCurrency = "EUR"
    const mockChain = {
      id: "accor",
      basePointRate: 2.5,
      calculationCurrency: "EUR",
      userStatuses: [{ eliteStatus: null }],
    };
    prismaMock.hotelChain.findUnique.mockResolvedValue(mockChain);

    // 1 EUR = 1.1 USD
    resolveCalcCurrencyRateMock.mockResolvedValue(1.1);

    // USD booking: $110 pretax, exchangeRate = 1 (USD)
    // USD pretax = 110 * 1 = 110 USD
    // EUR pretax = 110 / 1.1 = 100 EUR
    // Points = round(100 * 2.5) = 250
    const mockBookings = [{ id: "b1", pretaxCost: 110, currency: "USD", exchangeRate: 1 }];
    prismaMock.booking.findMany.mockResolvedValue(mockBookings);

    await recalculateLoyaltyForHotelChain("accor", "user-1");

    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { loyaltyPointsEarned: 250 },
      })
    );
  });
});
