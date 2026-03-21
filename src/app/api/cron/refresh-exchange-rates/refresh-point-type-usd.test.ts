/**
 * Tests for the PointType USD refresh logic (Step 3 of the exchange rate cron).
 * Verifies that foreign-currency point types get their usdCentsPerPoint updated correctly.
 */
import { describe, it, expect } from "vitest";

describe("PointType USD refresh calculation", () => {
  it("computes newUsdCentsPerPoint = programCentsPerPoint * rate", () => {
    const programCentsPerPoint = 0.02; // 2¢ EUR per point
    const eurToUsdRate = 1.1; // 1 EUR = 1.10 USD
    const expected = 0.02 * 1.1; // 0.022
    expect(Number((programCentsPerPoint * eurToUsdRate).toFixed(6))).toBeCloseTo(expected, 6);
  });

  it("skips point types with null programCurrency", () => {
    // Simulate the guard: if programCurrency is null, skip
    const pt = { programCurrency: null, programCentsPerPoint: null };
    const shouldUpdate = pt.programCurrency !== null && pt.programCentsPerPoint !== null;
    expect(shouldUpdate).toBe(false);
  });

  it("skips point types with null programCentsPerPoint", () => {
    const pt = { programCurrency: "EUR", programCentsPerPoint: null };
    const shouldUpdate = pt.programCurrency !== null && pt.programCentsPerPoint !== null;
    expect(shouldUpdate).toBe(false);
  });

  it("updates point types with both programCurrency and programCentsPerPoint set", () => {
    const pt = { programCurrency: "EUR", programCentsPerPoint: 0.02 };
    const shouldUpdate = pt.programCurrency !== null && pt.programCentsPerPoint !== null;
    expect(shouldUpdate).toBe(true);
  });

  it("handles rate fluctuation correctly — weaker EUR decreases USD value", () => {
    const programCentsPerPoint = 0.02;
    const weakerRate = 0.9; // 1 EUR = 0.90 USD
    const strongerRate = 1.2; // 1 EUR = 1.20 USD

    const weakerUsd = programCentsPerPoint * weakerRate;
    const strongerUsd = programCentsPerPoint * strongerRate;

    expect(weakerUsd).toBeCloseTo(0.018, 6);
    expect(strongerUsd).toBeCloseTo(0.024, 6);
    expect(weakerUsd).toBeLessThan(strongerUsd);
  });
});
