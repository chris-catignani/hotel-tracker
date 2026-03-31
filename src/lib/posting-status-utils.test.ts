import { describe, it, expect } from "vitest";
import {
  formatPromotionValue,
  formatLoyaltyValue,
  formatCardRewardValue,
  formatPerkValue,
  formatPortalValue,
  nextPostingStatus,
} from "@/lib/posting-status-utils";

describe("nextPostingStatus", () => {
  it("cycles pending → posted → failed → pending", () => {
    expect(nextPostingStatus("pending")).toBe("posted");
    expect(nextPostingStatus("posted")).toBe("failed");
    expect(nextPostingStatus("failed")).toBe("pending");
  });
});

describe("formatLoyaltyValue", () => {
  it("formats points with program name", () => {
    expect(formatLoyaltyValue(4200, "World of Hyatt")).toBe("4,200 pts");
  });
  it("returns null when no points", () => {
    expect(formatLoyaltyValue(null, "World of Hyatt")).toBeNull();
  });
});

describe("formatCardRewardValue", () => {
  it("formats cashback as dollars", () => {
    expect(formatCardRewardValue(45.0, "cashback", null)).toBe("$45.00");
  });
  it("formats points with type name, converting USD value to points count", () => {
    // $15 value at 0.01 USD/pt = 1500 pts
    expect(formatCardRewardValue(15, "points", "Membership Rewards", 0.01)).toBe("1,500 MR pts");
  });
  it("falls back to 0.01 USD/pt when centsPerPoint not provided", () => {
    expect(formatCardRewardValue(15, "points", "Membership Rewards")).toBe("1,500 MR pts");
  });
});

describe("formatPromotionValue", () => {
  it("formats points reward", () => {
    expect(
      formatPromotionValue({ rewardType: "points", bonusPointsApplied: 4200, appliedValue: 84 })
    ).toBe("+4,200 pts");
  });
  it("formats cashback reward", () => {
    expect(
      formatPromotionValue({ rewardType: "cashback", bonusPointsApplied: null, appliedValue: 84 })
    ).toBe("$84.00");
  });
  it("formats eqn reward", () => {
    expect(
      formatPromotionValue({ rewardType: "eqn", bonusPointsApplied: null, appliedValue: 20 })
    ).toBe("+2 EQNs");
  });
  it("formats certificate reward", () => {
    expect(
      formatPromotionValue({ rewardType: "certificate", bonusPointsApplied: null, appliedValue: 0 })
    ).toBe("Cert");
  });
  it("shows points from bonusPointsApplied when set", () => {
    expect(
      formatPromotionValue({
        promotion: { benefits: [{ rewardType: "points" }] },
        bonusPointsApplied: 5000,
        appliedValue: 100,
      })
    ).toBe("+5,000 pts");
  });
  it("reads rewardType from benefits for eqn", () => {
    expect(
      formatPromotionValue({
        promotion: { benefits: [{ rewardType: "eqn" }] },
        bonusPointsApplied: null,
        appliedValue: 60,
      })
    ).toBe("+6 EQNs");
  });
});

describe("formatPortalValue", () => {
  it("formats cashback portals as USD", () => {
    expect(formatPortalValue(15, "cashback")).toBe("$15.00");
  });
  it("formats points portals with raw points count", () => {
    expect(formatPortalValue(0, "points", null, 1.2, 1500)).toBe("1,500 pts");
  });
  it("includes abbreviated point type name", () => {
    // "Membership Rewards" abbreviates to "MR"
    expect(formatPortalValue(0, "points", "Membership Rewards", 1.5, 2000)).toBe("2,000 MR pts");
  });
  it("handles Prisma string values for usdCentsPerPoint", () => {
    expect(formatPortalValue(0, "points", null, "1.2" as unknown as number, 1500)).toBe(
      "1,500 pts"
    );
  });
});

describe("formatPerkValue", () => {
  it("returns dollar value when set", () => {
    expect(formatPerkValue("free_breakfast", 60)).toBe("$60.00");
  });
  it("returns label when no dollar value", () => {
    expect(formatPerkValue("room_upgrade", null)).toBe("Room Upgrade");
  });
  it("uses custom label when provided", () => {
    expect(formatPerkValue("other", null, "Airport Transfer")).toBe("Airport Transfer");
  });
  it("formats dollarValue using the provided currency", () => {
    expect(formatPerkValue("dining_credit", 120, null, "MYR")).not.toContain("$");
    expect(formatPerkValue("dining_credit", 120, null, "MYR")).toContain("MYR");
  });
});
