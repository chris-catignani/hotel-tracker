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
        id: 1,
        hotelChainId: 1,
        name: "GHA Discovery",
        bonusPercentage: null,
        fixedRate: 0.07,
        isFixed: true,
      };
      expect(calculatePoints({ pretaxCost: 100, basePointRate: null, eliteStatus })).toBe(7);
      expect(calculatePoints({ pretaxCost: 100, basePointRate: 5, eliteStatus })).toBe(7); // fixed rate overrides base rate
    });

    it("should calculate bonus points for percentage status", () => {
      const eliteStatus = {
        id: 1,
        hotelChainId: 1,
        name: "Marriott Gold",
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
            id: 1,
            hotelChainId: 1,
            name: "Sliver",
            bonusPercentage: 0.05,
            fixedRate: null,
            isFixed: false,
          },
        })
      ).toBe(1050);
    });
  });
});
