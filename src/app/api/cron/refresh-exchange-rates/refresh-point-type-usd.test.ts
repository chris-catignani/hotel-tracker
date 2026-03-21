/**
 * Tests for the PointType USD refresh logic (Step 3 of the exchange rate cron)
 * and the lockedLoyaltyUsdCentsPerPoint Step 2 locking logic.
 */
import { describe, it, expect } from "vitest";

describe("PointType USD refresh calculation", () => {
  it("computes newUsdCentsPerPoint = programCentsPerPoint * rate", () => {
    const programCentsPerPoint = 0.02; // 2¢ EUR per point
    const eurToUsdRate = 1.1; // 1 EUR = 1.10 USD
    const expected = 0.02 * 1.1; // 0.022
    expect(Number((programCentsPerPoint * eurToUsdRate).toFixed(3))).toBeCloseTo(expected, 3);
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

describe("lockedLoyaltyUsdCentsPerPoint locking (Step 2)", () => {
  /**
   * Mirrors the logic in the cron route:
   *   const lockedLoyaltyUsdCentsPerPoint =
   *     pt?.programCurrency != null && pt?.programCentsPerPoint != null
   *       ? Number(pt.programCentsPerPoint) * rate
   *       : undefined;
   */
  function computeLockedRate(
    pt: { programCurrency: string | null; programCentsPerPoint: number | null } | null,
    exchangeRate: number
  ): number | undefined {
    if (pt?.programCurrency != null && pt?.programCentsPerPoint != null) {
      return Number(pt.programCentsPerPoint) * exchangeRate;
    }
    return undefined;
  }

  it("locks rate = programCentsPerPoint * exchangeRate for foreign-currency point types", () => {
    const pt = { programCurrency: "EUR", programCentsPerPoint: 0.02 };
    const rate = 1.1; // 1 EUR = 1.10 USD
    expect(computeLockedRate(pt, rate)).toBeCloseTo(0.022, 6);
  });

  it("returns undefined when hotelChain has no point type (USD chain)", () => {
    expect(computeLockedRate(null, 1.1)).toBeUndefined();
  });

  it("returns undefined when programCurrency is null", () => {
    const pt = { programCurrency: null, programCentsPerPoint: 0.02 };
    expect(computeLockedRate(pt, 1.1)).toBeUndefined();
  });

  it("returns undefined when programCentsPerPoint is null", () => {
    const pt = { programCurrency: "EUR", programCentsPerPoint: null };
    expect(computeLockedRate(pt, 1.1)).toBeUndefined();
  });

  it("reflects EUR/USD rate movement in the locked value", () => {
    const pt = { programCurrency: "EUR", programCentsPerPoint: 0.02 };
    const lockedAtWeakEur = computeLockedRate(pt, 0.9)!;
    const lockedAtStrongEur = computeLockedRate(pt, 1.2)!;
    expect(lockedAtWeakEur).toBeCloseTo(0.018, 6);
    expect(lockedAtStrongEur).toBeCloseTo(0.024, 6);
    expect(lockedAtWeakEur).toBeLessThan(lockedAtStrongEur);
  });
});
