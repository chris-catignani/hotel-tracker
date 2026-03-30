import { describe, it, expect } from "vitest";
import {
  formatPromotionValue,
  formatLoyaltyValue,
  formatCardRewardValue,
  formatPerkValue,
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
  it("formats points with type name", () => {
    expect(formatCardRewardValue(15000, "points", "Membership Rewards")).toBe("15,000 MR pts");
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
      formatPromotionValue({ rewardType: "eqn", bonusPointsApplied: null, appliedValue: 2 })
    ).toBe("+2 EQNs");
  });
  it("formats certificate reward", () => {
    expect(
      formatPromotionValue({ rewardType: "certificate", bonusPointsApplied: null, appliedValue: 0 })
    ).toBe("Cert");
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
});
