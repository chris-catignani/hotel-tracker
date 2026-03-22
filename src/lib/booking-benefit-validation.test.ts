import { describe, it, expect } from "vitest";
import { validateBenefitConstraints } from "./booking-benefit-validation";

describe("validateBenefitConstraints", () => {
  it("returns null for a valid cash benefit", () => {
    expect(validateBenefitConstraints({ dollarValue: 25, pointsEarnType: null }, false)).toBeNull();
  });

  it("rejects benefit with both dollarValue and pointsEarnType", () => {
    expect(
      validateBenefitConstraints({ dollarValue: 25, pointsEarnType: "fixed_per_stay" }, true)
    ).toMatch(/cannot have both/);
  });

  it("rejects unknown pointsEarnType", () => {
    expect(validateBenefitConstraints({ pointsEarnType: "bonus_night" }, true)).toMatch(
      /Unknown pointsEarnType/
    );
  });

  it("rejects points benefit when chain has no loyalty program", () => {
    expect(
      validateBenefitConstraints({ pointsEarnType: "fixed_per_stay", pointsAmount: 1000 }, false)
    ).toMatch(/loyalty program/);
  });

  it("returns null for valid fixed_per_stay", () => {
    expect(
      validateBenefitConstraints({ pointsEarnType: "fixed_per_stay", pointsAmount: 1000 }, true)
    ).toBeNull();
  });

  it("rejects fixed_per_stay without pointsAmount", () => {
    expect(validateBenefitConstraints({ pointsEarnType: "fixed_per_stay" }, true)).toMatch(
      /require pointsAmount/
    );
  });

  it("rejects fixed_per_stay with pointsMultiplier", () => {
    expect(
      validateBenefitConstraints(
        { pointsEarnType: "fixed_per_stay", pointsAmount: 1000, pointsMultiplier: 2.0 },
        true
      )
    ).toMatch(/cannot have pointsMultiplier/);
  });

  it("returns null for valid fixed_per_night", () => {
    expect(
      validateBenefitConstraints({ pointsEarnType: "fixed_per_night", pointsAmount: 500 }, true)
    ).toBeNull();
  });

  it("returns null for valid multiplier_on_base", () => {
    expect(
      validateBenefitConstraints(
        { pointsEarnType: "multiplier_on_base", pointsMultiplier: 2.0 },
        true
      )
    ).toBeNull();
  });

  it("rejects multiplier_on_base without pointsMultiplier", () => {
    expect(validateBenefitConstraints({ pointsEarnType: "multiplier_on_base" }, true)).toMatch(
      /requires pointsMultiplier/
    );
  });

  it("rejects multiplier_on_base with pointsAmount", () => {
    expect(
      validateBenefitConstraints(
        { pointsEarnType: "multiplier_on_base", pointsMultiplier: 2.0, pointsAmount: 100 },
        true
      )
    ).toMatch(/cannot have pointsAmount/);
  });

  it("returns null for a purely informational benefit (no value)", () => {
    expect(
      validateBenefitConstraints({ dollarValue: null, pointsEarnType: null }, false)
    ).toBeNull();
  });
});
