import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    hotelChain: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    booking: { count: vi.fn() },
    hotelChainSubBrand: { count: vi.fn() },
  },
}));

vi.mock("@/services/exchange-rate", () => ({
  getCurrentRate: vi.fn(),
}));

vi.mock("@/services/loyalty-recalculation", () => ({
  recalculateLoyaltyForHotelChain: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getCurrentRate } from "@/services/exchange-rate";
import { parseCalculationCurrency, listHotelChains, getHotelChain } from "./hotel-chain.service";

const prismaMock = prisma as unknown as {
  hotelChain: {
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
  };
  booking: { count: Mock };
  hotelChainSubBrand: { count: Mock };
};

// mockChain has userStatuses array — normalizeUserStatuses converts it to userStatus
const mockChain = {
  id: "chain-1",
  name: "Hyatt",
  calculationCurrency: "USD",
  basePointRate: "0.5",
  loyaltyProgram: "World of Hyatt",
  pointTypeId: null,
  pointType: null,
  hotelChainSubBrands: [],
  eliteStatuses: [],
  userStatuses: [],
};

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// parseCalculationCurrency
// ---------------------------------------------------------------------------

describe("parseCalculationCurrency", () => {
  it("returns USD when value is undefined/empty", () => {
    expect(parseCalculationCurrency(undefined)).toBe("USD");
    expect(parseCalculationCurrency("")).toBe("USD");
  });

  it("returns the currency code for valid 3-letter codes", () => {
    expect(parseCalculationCurrency("EUR")).toBe("EUR");
    expect(parseCalculationCurrency("USD")).toBe("USD");
  });

  it("returns null for invalid codes", () => {
    expect(parseCalculationCurrency("US")).toBe(null);
    expect(parseCalculationCurrency("USDX")).toBe(null);
    expect(parseCalculationCurrency("usd")).toBe(null);
    expect(parseCalculationCurrency(123)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// listHotelChains
// ---------------------------------------------------------------------------

describe("listHotelChains", () => {
  it("queries by userId in userStatuses and returns normalized results", async () => {
    prismaMock.hotelChain.findMany.mockResolvedValueOnce([mockChain]);

    const result = await listHotelChains("user-1");

    expect(prismaMock.hotelChain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          userStatuses: expect.objectContaining({ where: { userId: "user-1" } }),
        }),
      })
    );
    // normalizeUserStatuses converts userStatuses array → userStatus singular
    expect(result[0]).toMatchObject({ id: "chain-1", userStatus: null });
  });

  it("enriches non-USD chains with calcCurrencyToUsdRate", async () => {
    const eurChain = { ...mockChain, id: "chain-2", calculationCurrency: "EUR" };
    prismaMock.hotelChain.findMany.mockResolvedValueOnce([eurChain]);
    (getCurrentRate as Mock).mockResolvedValueOnce(1.08);

    const result = await listHotelChains("user-1");

    expect(getCurrentRate).toHaveBeenCalledWith("EUR");
    expect(result[0]).toMatchObject({ calcCurrencyToUsdRate: 1.08 });
  });

  it("sets calcCurrencyToUsdRate to null for USD chains", async () => {
    prismaMock.hotelChain.findMany.mockResolvedValueOnce([mockChain]);

    const result = await listHotelChains("user-1");

    expect(getCurrentRate).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ calcCurrencyToUsdRate: null });
  });
});

// ---------------------------------------------------------------------------
// getHotelChain
// ---------------------------------------------------------------------------

describe("getHotelChain", () => {
  it("returns the normalized chain when found", async () => {
    prismaMock.hotelChain.findUnique.mockResolvedValueOnce(mockChain);

    const result = await getHotelChain("chain-1", "user-1");

    expect(prismaMock.hotelChain.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chain-1" },
        include: expect.objectContaining({
          userStatuses: expect.objectContaining({ where: { userId: "user-1" } }),
        }),
      })
    );
    expect(result).toMatchObject({ id: "chain-1", userStatus: null });
  });

  it("throws AppError(404) when not found", async () => {
    prismaMock.hotelChain.findUnique.mockResolvedValueOnce(null);

    await expect(getHotelChain("missing", "user-1")).rejects.toMatchObject({ statusCode: 404 });
  });
});
