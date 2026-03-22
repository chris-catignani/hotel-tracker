import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { enrichBookingWithRate } from "./booking-enrichment";

vi.mock("./exchange-rate", () => ({
  getCurrentRate: vi.fn(),
  resolveCalcCurrencyRate: vi.fn().mockResolvedValue(null),
}));

vi.mock("./loyalty-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./loyalty-utils")>();
  return { ...actual, calculatePoints: vi.fn() };
});

vi.mock("./prisma", () => ({
  default: {
    exchangeRateHistory: { findUnique: vi.fn() },
  },
}));

import { getCurrentRate, resolveCalcCurrencyRate } from "./exchange-rate";
import { calculatePoints } from "./loyalty-utils";
import prisma from "./prisma";

const mockGetCurrentRate = getCurrentRate as Mock;
const mockResolveCalcCurrencyRate = resolveCalcCurrencyRate as Mock;
const mockCalculatePoints = calculatePoints as Mock;
const prismaMock = prisma as unknown as {
  exchangeRateHistory: { findUnique: Mock };
};

const pastDate = new Date("2024-06-01T00:00:00Z");
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const futureDateStr = futureDate.toISOString().split("T")[0];

const baseBooking = {
  currency: "USD",
  lockedExchangeRate: 1,
  checkIn: pastDate,
  loyaltyPointsEarned: 1000,
  pretaxCost: "100",
  hotelChain: {
    basePointRate: 10,
    userStatuses: [],
  },
  hotelChainSubBrand: null,
};

describe("enrichBookingWithRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("USD booking (past)", () => {
    it("returns stored exchangeRate of 1, isFutureEstimate=false, no loyalty estimation", async () => {
      const result = await enrichBookingWithRate(baseBooking);

      expect(result.lockedExchangeRate).toBe(1);
      expect(result.isFutureEstimate).toBe(false);
      expect(result.loyaltyPointsEstimated).toBe(false);
      expect(result.loyaltyPointsEarned).toBe(1000);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });

  describe("past non-USD booking with stored rate", () => {
    beforeEach(() => {
      prismaMock.exchangeRateHistory.findUnique.mockResolvedValue({ rate: "0.65" });
    });

    it("uses the stored exchangeRate, no live lookup, isFutureEstimate=false", async () => {
      const booking = {
        ...baseBooking,
        currency: "EUR",
        lockedExchangeRate: 1.08,
        checkIn: pastDate,
        loyaltyPointsEarned: 800,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.lockedExchangeRate).toBe(1.08);
      expect(result.isFutureEstimate).toBe(false);
      expect(result.loyaltyPointsEstimated).toBe(false);
      expect(result.loyaltyPointsEarned).toBe(800);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });

  describe("future non-USD booking (no stored rate)", () => {
    it("calls getCurrentRate, marks isFutureEstimate=true", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.92);

      const booking = {
        ...baseBooking,
        currency: "EUR",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 500,
      };

      const result = await enrichBookingWithRate(booking);

      expect(mockGetCurrentRate).toHaveBeenCalledWith("EUR");
      expect(result.lockedExchangeRate).toBe(0.92);
      expect(result.isFutureEstimate).toBe(true);
      expect(result.loyaltyPointsEstimated).toBe(false); // points already stored
      expect(result.loyaltyPointsEarned).toBe(500);
    });

    it("resolvedRate stays null when getCurrentRate returns null (no cached rate)", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(null);

      const booking = {
        ...baseBooking,
        currency: "SGD",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 0,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.lockedExchangeRate).toBeNull();
      expect(result.isFutureEstimate).toBe(true);
    });

    it("estimates loyalty points when loyaltyPointsEarned is null and rate is available", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.74);
      mockCalculatePoints.mockReturnValueOnce(370);

      const booking = {
        ...baseBooking,
        currency: "SGD",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "500",
        hotelChain: {
          basePointRate: 10,
          userStatuses: [],
        },
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.loyaltyPointsEstimated).toBe(true);
      expect(result.loyaltyPointsEarned).toBe(370);
      // USD pretax = 500 * 0.74 = 370; calculatePoints called with usdPretax
      expect(mockCalculatePoints).toHaveBeenCalledWith(
        expect.objectContaining({ pretaxCost: 500 * 0.74 })
      );
    });

    it("reads elite status from normalized userStatus (singular) when userStatuses array is absent", async () => {
      // This is the bug case: normalizeUserStatuses() converts userStatuses[] → userStatus
      // before enrichBookingWithRate is called, so the array is no longer present.
      mockGetCurrentRate.mockResolvedValueOnce(0.74);
      mockCalculatePoints.mockReturnValueOnce(648);

      const eliteStatus = { isFixed: false, bonusPercentage: 0.75, fixedRate: null };
      const booking = {
        ...baseBooking,
        currency: "SGD",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "500",
        hotelChain: {
          basePointRate: 10,
          // userStatus (singular) — the normalized form; no userStatuses array
          userStatus: { eliteStatus },
        },
      };

      await enrichBookingWithRate(booking);

      expect(mockCalculatePoints).toHaveBeenCalledWith(expect.objectContaining({ eliteStatus }));
    });

    it("uses subBrand basePointRate when available for estimated loyalty", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.5);
      mockCalculatePoints.mockReturnValueOnce(200);

      const booking = {
        ...baseBooking,
        currency: "MYR",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "400",
        hotelChain: {
          basePointRate: 10,
          userStatuses: [],
        },
        hotelChainSubBrand: { basePointRate: "15" },
      };

      const result = await enrichBookingWithRate(booking);

      expect(mockCalculatePoints).toHaveBeenCalledWith(
        expect.objectContaining({ basePointRate: 15 })
      );
      expect(result.loyaltyPointsEstimated).toBe(true);
    });

    it("does not estimate loyalty when rate is unavailable", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(null);

      const booking = {
        ...baseBooking,
        currency: "KRW",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
      };

      const result = await enrichBookingWithRate(booking);

      expect(mockCalculatePoints).not.toHaveBeenCalled();
      expect(result.loyaltyPointsEarned).toBeNull();
      expect(result.loyaltyPointsEstimated).toBe(false);
    });

    it("passes calculationCurrency and calcCurrencyToUsdRate when chain uses non-USD rates", async () => {
      // KRW booking, chain with EUR calculationCurrency
      mockGetCurrentRate.mockResolvedValueOnce(0.00067); // KRW→USD rate
      mockResolveCalcCurrencyRate.mockResolvedValueOnce(1.1); // EUR→USD rate
      mockCalculatePoints.mockReturnValueOnce(175);

      const booking = {
        ...baseBooking,
        currency: "KRW",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "119000",
        hotelChain: {
          basePointRate: 1.25,
          calculationCurrency: "EUR",
          userStatuses: [],
        },
      };

      await enrichBookingWithRate(booking);

      expect(mockGetCurrentRate).toHaveBeenCalledWith("KRW");
      expect(mockResolveCalcCurrencyRate).toHaveBeenCalledWith("EUR");
      expect(mockCalculatePoints).toHaveBeenCalledWith(
        expect.objectContaining({
          calculationCurrency: "EUR",
          calcCurrencyToUsdRate: 1.1,
        })
      );
    });
  });

  describe("future USD booking", () => {
    it("uses stored exchangeRate=1 and is never a future estimate (USD)", async () => {
      const booking = {
        ...baseBooking,
        currency: "USD",
        lockedExchangeRate: 1,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 200,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.isFutureEstimate).toBe(false);
      expect(result.lockedExchangeRate).toBe(1);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });

  describe("exchangeRateEstimated", () => {
    const pastNonUsdBooking = {
      ...baseBooking,
      currency: "AUD",
      lockedExchangeRate: "0.63",
      checkIn: new Date("2022-01-15T00:00:00Z"), // very old, pre-API coverage
    };

    it("is true when no ExchangeRateHistory exists for checkIn or checkIn-1", async () => {
      prismaMock.exchangeRateHistory.findUnique.mockResolvedValue(null);

      const result = await enrichBookingWithRate(pastNonUsdBooking);

      expect(result.exchangeRateEstimated).toBe(true);
    });

    it("is false when ExchangeRateHistory exists for checkIn-1 (same-day check-in case)", async () => {
      // First call (checkIn date) returns null, second call (checkIn-1) returns a record
      prismaMock.exchangeRateHistory.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ rate: "0.63" });

      const result = await enrichBookingWithRate(pastNonUsdBooking);

      expect(result.exchangeRateEstimated).toBe(false);
    });

    it("is false when ExchangeRateHistory exists for checkIn date itself", async () => {
      prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce({ rate: "0.63" });

      const result = await enrichBookingWithRate(pastNonUsdBooking);

      expect(result.exchangeRateEstimated).toBe(false);
    });

    it("is false for a USD booking", async () => {
      const result = await enrichBookingWithRate(baseBooking); // baseBooking is USD
      expect(result.exchangeRateEstimated).toBe(false);
      expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
    });

    it("is false for a future non-USD booking", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.63);
      const futureBooking = {
        ...baseBooking,
        currency: "AUD",
        lockedExchangeRate: null,
        checkIn: futureDate,
      };

      const result = await enrichBookingWithRate(futureBooking);

      expect(result.exchangeRateEstimated).toBe(false);
      expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
    });
  });
});
