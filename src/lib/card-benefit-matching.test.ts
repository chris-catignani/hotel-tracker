import { describe, it, expect } from "vitest";
import { getPeriodKey, matchCardBenefits } from "./card-benefit-matching";
import type { CardBenefitForMatching, BookingCardBenefitUsage } from "./card-benefit-matching";

// ---------------------------------------------------------------------------
// getPeriodKey
// ---------------------------------------------------------------------------

describe("getPeriodKey", () => {
  it("annual: returns year", () => {
    expect(getPeriodKey(new Date("2025-06-15T00:00:00Z"), "annual")).toBe("2025");
    expect(getPeriodKey(new Date("2025-12-31T00:00:00Z"), "annual")).toBe("2025");
    expect(getPeriodKey(new Date("2026-01-01T00:00:00Z"), "annual")).toBe("2026");
  });

  it("semi_annual: H1 = Jan–Jun, H2 = Jul–Dec", () => {
    expect(getPeriodKey(new Date("2025-01-01T00:00:00Z"), "semi_annual")).toBe("2025-H1");
    expect(getPeriodKey(new Date("2025-06-30T00:00:00Z"), "semi_annual")).toBe("2025-H1");
    expect(getPeriodKey(new Date("2025-07-01T00:00:00Z"), "semi_annual")).toBe("2025-H2");
    expect(getPeriodKey(new Date("2025-12-31T00:00:00Z"), "semi_annual")).toBe("2025-H2");
  });

  it("quarterly: Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec", () => {
    expect(getPeriodKey(new Date("2025-01-01T00:00:00Z"), "quarterly")).toBe("2025-Q1");
    expect(getPeriodKey(new Date("2025-03-31T00:00:00Z"), "quarterly")).toBe("2025-Q1");
    expect(getPeriodKey(new Date("2025-04-01T00:00:00Z"), "quarterly")).toBe("2025-Q2");
    expect(getPeriodKey(new Date("2025-06-30T00:00:00Z"), "quarterly")).toBe("2025-Q2");
    expect(getPeriodKey(new Date("2025-07-01T00:00:00Z"), "quarterly")).toBe("2025-Q3");
    expect(getPeriodKey(new Date("2025-09-30T00:00:00Z"), "quarterly")).toBe("2025-Q3");
    expect(getPeriodKey(new Date("2025-10-01T00:00:00Z"), "quarterly")).toBe("2025-Q4");
    expect(getPeriodKey(new Date("2025-12-31T00:00:00Z"), "quarterly")).toBe("2025-Q4");
  });

  it("monthly: returns YYYY-MM", () => {
    expect(getPeriodKey(new Date("2025-01-15T00:00:00Z"), "monthly")).toBe("2025-01");
    expect(getPeriodKey(new Date("2025-09-01T00:00:00Z"), "monthly")).toBe("2025-09");
    expect(getPeriodKey(new Date("2025-12-31T00:00:00Z"), "monthly")).toBe("2025-12");
  });

  it("handles year crossings", () => {
    expect(getPeriodKey(new Date("2024-12-31T00:00:00Z"), "quarterly")).toBe("2024-Q4");
    expect(getPeriodKey(new Date("2025-01-01T00:00:00Z"), "quarterly")).toBe("2025-Q1");
    expect(getPeriodKey(new Date("2024-12-31T00:00:00Z"), "semi_annual")).toBe("2024-H2");
    expect(getPeriodKey(new Date("2025-01-01T00:00:00Z"), "semi_annual")).toBe("2025-H1");
  });
});

// ---------------------------------------------------------------------------
// matchCardBenefits
// ---------------------------------------------------------------------------

const makeBenefit = (overrides: Partial<CardBenefitForMatching> = {}): CardBenefitForMatching => ({
  id: "b1",
  creditCardId: "cc1",
  description: "Quarterly Hilton credit",
  value: 50,
  period: "quarterly",
  hotelChainId: "hilton",
  isActive: true,
  ...overrides,
});

const checkIn = new Date("2025-04-10T00:00:00Z"); // Q2 2025

describe("matchCardBenefits", () => {
  it("applies full benefit when no prior usage", () => {
    const result = matchCardBenefits([makeBenefit()], [], "hilton", checkIn, 200);
    expect(result).toHaveLength(1);
    expect(result[0].appliedValue).toBe(50);
    expect(result[0].periodKey).toBe("2025-Q2");
  });

  it("skips inactive benefits", () => {
    const result = matchCardBenefits(
      [makeBenefit({ isActive: false })],
      [],
      "hilton",
      checkIn,
      200
    );
    expect(result).toHaveLength(0);
  });

  it("skips benefit when hotel chain does not match", () => {
    const result = matchCardBenefits([makeBenefit()], [], "marriott", checkIn, 200);
    expect(result).toHaveLength(0);
  });

  it("applies benefit when hotelChainId is null (any hotel)", () => {
    const result = matchCardBenefits(
      [makeBenefit({ hotelChainId: null })],
      [],
      "marriott",
      checkIn,
      200
    );
    expect(result).toHaveLength(1);
    expect(result[0].appliedValue).toBe(50);
  });

  it("caps applied value at totalCostUSD", () => {
    const result = matchCardBenefits([makeBenefit()], [], "hilton", checkIn, 30);
    expect(result[0].appliedValue).toBe(30);
  });

  it("deducts prior usage in same period", () => {
    const usage: BookingCardBenefitUsage[] = [
      { cardBenefitId: "b1", appliedValue: 40, periodKey: "2025-Q2" },
    ];
    const result = matchCardBenefits([makeBenefit()], usage, "hilton", checkIn, 200);
    expect(result[0].appliedValue).toBe(10); // 50 - 40
  });

  it("skips when benefit is fully exhausted in period", () => {
    const usage: BookingCardBenefitUsage[] = [
      { cardBenefitId: "b1", appliedValue: 50, periodKey: "2025-Q2" },
    ];
    const result = matchCardBenefits([makeBenefit()], usage, "hilton", checkIn, 200);
    expect(result).toHaveLength(0);
  });

  it("ignores usage from a different period", () => {
    const usage: BookingCardBenefitUsage[] = [
      { cardBenefitId: "b1", appliedValue: 50, periodKey: "2025-Q1" }, // Q1, not Q2
    ];
    const result = matchCardBenefits([makeBenefit()], usage, "hilton", checkIn, 200);
    expect(result[0].appliedValue).toBe(50); // fresh period
  });

  it("handles two independent benefits", () => {
    const b1 = makeBenefit({ id: "b1", value: 50, period: "quarterly" });
    const b2 = makeBenefit({
      id: "b2",
      description: "Annual any-hotel credit",
      value: 100,
      period: "annual",
      hotelChainId: null,
    });
    const result = matchCardBenefits([b1, b2], [], "hilton", checkIn, 200);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.cardBenefitId === "b1")?.appliedValue).toBe(50);
    expect(result.find((r) => r.cardBenefitId === "b2")?.appliedValue).toBe(100);
  });

  it("applies 0 when totalCostUSD is 0", () => {
    const result = matchCardBenefits([makeBenefit()], [], "hilton", checkIn, 0);
    expect(result).toHaveLength(0);
  });

  it("partial cap: remaining benefit capped at cost", () => {
    const usage: BookingCardBenefitUsage[] = [
      { cardBenefitId: "b1", appliedValue: 20, periodKey: "2025-Q2" },
    ];
    // remaining = 30, but totalCost = 25 → applied = 25
    const result = matchCardBenefits([makeBenefit()], usage, "hilton", checkIn, 25);
    expect(result[0].appliedValue).toBe(25);
  });
});
