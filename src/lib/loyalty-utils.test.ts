import { describe, it, expect } from "vitest";
import { calculatePoints } from "./loyalty-utils";

describe("loyalty-utils", () => {
  describe("calculatePoints", () => {
    it("should return 0 if no rates or status provided", () => {
      expect(calculatePoints({ pretaxCost: 100, basePointRate: null })).toBe(0);
    });

    it("should calculate base points when only baseRate provided", () => {
      expect(calculatePoints({ pretaxCost: 100, basePointRate: 10 })).toBe(1000);
    });

    it("should calculate fixed points for fixed status", () => {
      const eliteStatus = {
        bonusPercentage: null,
        fixedRate: 0.07,
        isFixed: true,
      };
      expect(calculatePoints({ pretaxCost: 100, basePointRate: null, eliteStatus })).toBe(7);
      expect(calculatePoints({ pretaxCost: 100, basePointRate: 5, eliteStatus })).toBe(7); // fixed rate overrides base rate
    });

    it("should calculate bonus points for percentage status", () => {
      const eliteStatus = {
        bonusPercentage: 0.25,
        fixedRate: null,
        isFixed: false,
      };
      // baseRate 10 points/$ * 100$ = 1000 base points.
      // 25% bonus of 1000 = 250 bonus points.
      // Total = 1250 points.
      expect(calculatePoints({ pretaxCost: 100, basePointRate: 10, eliteStatus })).toBe(1250);
    });

    it("should handle zero pretax cost", () => {
      expect(calculatePoints({ pretaxCost: 0, basePointRate: 10 })).toBe(0);
    });

    it("should round correctly", () => {
      // 99.99 * 10 = 999.9 -> 1000
      expect(calculatePoints({ pretaxCost: 99.99, basePointRate: 10 })).toBe(1000);

      // 99.5 * 10 = 995 -> 995
      expect(calculatePoints({ pretaxCost: 99.5, basePointRate: 10 })).toBe(995);

      // Percentage bonus: 100 * 10 * 1.05 = 1050
      expect(
        calculatePoints({
          pretaxCost: 100,
          basePointRate: 10,
          eliteStatus: {
            bonusPercentage: 0.05,
            fixedRate: null,
            isFixed: false,
          },
        })
      ).toBe(1050);
    });

    it("should convert USD to calc currency before applying base rate", () => {
      // 110 USD, rate 1 EUR = 1.1 USD → 100 EUR, at 2.5 pts/EUR = 250 pts
      expect(
        calculatePoints({
          pretaxCost: 110,
          basePointRate: 2.5,
          calculationCurrency: "EUR",
          calcCurrencyToUsdRate: 1.1,
        })
      ).toBe(250);
    });

    it("should apply elite bonus on EUR-converted cost", () => {
      // 110 USD → 100 EUR, 2.5 pts/EUR base, 76% bonus → round(100 * 2.5 * 1.76) = 440 pts
      expect(
        calculatePoints({
          pretaxCost: 110,
          basePointRate: 2.5,
          calculationCurrency: "EUR",
          calcCurrencyToUsdRate: 1.1,
          eliteStatus: { isFixed: false, fixedRate: null, bonusPercentage: 0.76 },
        })
      ).toBe(440);
    });

    it("should ignore calculationCurrency when calcCurrencyToUsdRate is not provided", () => {
      // Falls back to USD pretaxCost when rate is missing
      expect(
        calculatePoints({
          pretaxCost: 100,
          basePointRate: 2.5,
          calculationCurrency: "EUR",
          calcCurrencyToUsdRate: null,
        })
      ).toBe(250);
    });

    it("should floor fixed-rate points to nearest pointsFloorTo", () => {
      const eliteStatus = {
        isFixed: true,
        fixedRate: 7,
        bonusPercentage: null,
        pointsFloorTo: 100,
      };
      // 170.43 * 7 = 1193.01 → floor to 1100
      expect(calculatePoints({ pretaxCost: 170.43, basePointRate: null, eliteStatus })).toBe(1100);
      // 157.14 * 7 = 1099.98 → floor to 1000
      expect(calculatePoints({ pretaxCost: 157.14, basePointRate: null, eliteStatus })).toBe(1000);
      // 200 * 7 = 1400 → exactly on boundary, stays 1400
      expect(calculatePoints({ pretaxCost: 200, basePointRate: null, eliteStatus })).toBe(1400);
    });

    it("should not convert when calculationCurrency is USD", () => {
      expect(
        calculatePoints({
          pretaxCost: 100,
          basePointRate: 10,
          calculationCurrency: "USD",
          calcCurrencyToUsdRate: 1.1, // should be ignored
        })
      ).toBe(1000);
    });
  });
});
