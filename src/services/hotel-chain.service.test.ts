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
import { recalculateLoyaltyForHotelChain } from "@/services/loyalty-recalculation";
import {
  parseCalculationCurrency,
  listHotelChains,
  getHotelChain,
  createHotelChain,
  updateHotelChain,
} from "./hotel-chain.service";

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

// ---------------------------------------------------------------------------
// createHotelChain
// ---------------------------------------------------------------------------

describe("createHotelChain", () => {
  it("creates and returns the normalized chain", async () => {
    prismaMock.hotelChain.create.mockResolvedValueOnce(mockChain);

    const result = await createHotelChain({ name: "Hyatt" });

    expect(prismaMock.hotelChain.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Hyatt", calculationCurrency: "USD" }),
      })
    );
    expect(result).toMatchObject({ id: "chain-1" });
  });

  it("throws AppError(400) for invalid calculationCurrency", async () => {
    await expect(
      createHotelChain({ name: "Hyatt", calculationCurrency: "bad" })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(prismaMock.hotelChain.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateHotelChain
// ---------------------------------------------------------------------------

describe("updateHotelChain", () => {
  beforeEach(() => {
    prismaMock.hotelChain.findUnique.mockResolvedValue({
      basePointRate: "0.5",
      calculationCurrency: "USD",
    });
    prismaMock.hotelChain.update.mockResolvedValue({ ...mockChain, name: "Updated Hyatt" });
  });

  it("updates and returns the normalized chain", async () => {
    const result = await updateHotelChain("chain-1", "user-1", { name: "Updated Hyatt" });

    expect(prismaMock.hotelChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chain-1" },
        data: { name: "Updated Hyatt" },
      })
    );
    expect(result).toMatchObject({ id: "chain-1" });
  });

  it("throws AppError(400) for invalid calculationCurrency", async () => {
    await expect(
      updateHotelChain("chain-1", "user-1", { calculationCurrency: "xx" })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(prismaMock.hotelChain.update).not.toHaveBeenCalled();
  });

  it("throws AppError(404) when hotel chain not found", async () => {
    prismaMock.hotelChain.findUnique.mockResolvedValueOnce(null);

    await expect(updateHotelChain("missing", "user-1", { name: "New" })).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prismaMock.hotelChain.update).not.toHaveBeenCalled();
  });

  it("triggers loyalty recalculation when basePointRate changes", async () => {
    await updateHotelChain("chain-1", "user-1", { basePointRate: 1.0 });

    expect(recalculateLoyaltyForHotelChain).toHaveBeenCalledWith("chain-1");
  });

  it("triggers loyalty recalculation when calculationCurrency changes", async () => {
    await updateHotelChain("chain-1", "user-1", { calculationCurrency: "EUR" });

    expect(recalculateLoyaltyForHotelChain).toHaveBeenCalledWith("chain-1");
  });

  it("does NOT trigger loyalty recalculation when neither rate nor currency changes", async () => {
    await updateHotelChain("chain-1", "user-1", { name: "New Name" });

    expect(recalculateLoyaltyForHotelChain).not.toHaveBeenCalled();
  });
});
