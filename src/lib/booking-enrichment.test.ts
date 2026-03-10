import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { enrichBookingWithRate } from "./booking-enrichment";

vi.mock("./exchange-rate", () => ({
  getCurrentRate: vi.fn(),
  resolveCalcCurrencyRate: vi.fn().mockResolvedValue(null),
}));

vi.mock("./loyalty-utils", () => ({
  calculatePoints: vi.fn(),
}));

import { getCurrentRate, resolveCalcCurrencyRate } from "./exchange-rate";
import { calculatePoints } from "./loyalty-utils";

const mockGetCurrentRate = getCurrentRate as Mock;
const mockResolveCalcCurrencyRate = resolveCalcCurrencyRate as Mock;
const mockCalculatePoints = calculatePoints as Mock;

const pastDate = new Date("2024-06-01T00:00:00Z");
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const futureDateStr = futureDate.toISOString().split("T")[0];

const baseBooking = {
  currency: "USD",
  exchangeRate: 1,
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

      expect(result.exchangeRate).toBe(1);
      expect(result.isFutureEstimate).toBe(false);
      expect(result.loyaltyPointsEstimated).toBe(false);
      expect(result.loyaltyPointsEarned).toBe(1000);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });

  describe("past non-USD booking with stored rate", () => {
    it("uses the stored exchangeRate, no live lookup, isFutureEstimate=false", async () => {
      const booking = {
        ...baseBooking,
        currency: "EUR",
        exchangeRate: 1.08,
        checkIn: pastDate,
        loyaltyPointsEarned: 800,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.exchangeRate).toBe(1.08);
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
        exchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 500,
      };

      const result = await enrichBookingWithRate(booking);

      expect(mockGetCurrentRate).toHaveBeenCalledWith("EUR");
      expect(result.exchangeRate).toBe(0.92);
      expect(result.isFutureEstimate).toBe(true);
      expect(result.loyaltyPointsEstimated).toBe(false); // points already stored
      expect(result.loyaltyPointsEarned).toBe(500);
    });

    it("resolvedRate stays null when getCurrentRate returns null (no cached rate)", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(null);

      const booking = {
        ...baseBooking,
        currency: "SGD",
        exchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 0,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.exchangeRate).toBeNull();
      expect(result.isFutureEstimate).toBe(true);
    });

    it("estimates loyalty points when loyaltyPointsEarned is null and rate is available", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.74);
      mockCalculatePoints.mockReturnValueOnce(370);

      const booking = {
        ...baseBooking,
        currency: "SGD",
        exchangeRate: null,
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

    it("uses subBrand basePointRate when available for estimated loyalty", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.5);
      mockCalculatePoints.mockReturnValueOnce(200);

      const booking = {
        ...baseBooking,
        currency: "MYR",
        exchangeRate: null,
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
        exchangeRate: null,
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
        exchangeRate: null,
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
        exchangeRate: 1,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 200,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.isFutureEstimate).toBe(false);
      expect(result.exchangeRate).toBe(1);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });
});
