import { describe, it, expect } from "vitest";
import {
  formatPromotionValue,
  formatLoyaltyValue,
  formatCardRewardValue,
  formatPerkValue,
  formatPortalValue,
  formatPartnershipValue,
  nextPostingStatus,
  statusIcon,
} from "@/lib/posting-status-utils";

describe("nextPostingStatus", () => {
  it("cycles pending → posted → failed → pending", () => {
    expect(nextPostingStatus("pending")).toBe("posted");
    expect(nextPostingStatus("posted")).toBe("failed");
    expect(nextPostingStatus("failed")).toBe("pending");
  });
});

describe("statusIcon", () => {
  it("returns correct icon for each status", () => {
    expect(statusIcon("pending")).toBe("⏳");
    expect(statusIcon("posted")).toBe("✓");
    expect(statusIcon("failed")).toBe("✗");
  });
});

describe("formatLoyaltyValue", () => {
  it("formats points with shortName", () => {
    expect(formatLoyaltyValue(4200, "Hyatt")).toBe("4,200 Hyatt pts");
  });
  it("formats points without shortName", () => {
    expect(formatLoyaltyValue(4200, null)).toBe("4,200 pts");
  });
  it("returns null when no points", () => {
    expect(formatLoyaltyValue(null, "Hyatt")).toBeNull();
  });
});

describe("formatCardRewardValue", () => {
  it("formats cashback as dollars", () => {
    expect(formatCardRewardValue(45.0, "cashback", null)).toBe("$45.00");
  });
  it("formats points with shortName, converting USD value to points count", () => {
    // $15 value at 0.01 USD/pt = 1500 pts
    expect(formatCardRewardValue(15, "points", "MR", 0.01)).toBe("1,500 MR pts");
  });
  it("falls back to 0.01 USD/pt when centsPerPoint not provided", () => {
    expect(formatCardRewardValue(15, "points", "MR")).toBe("1,500 MR pts");
  });
  it("formats points without shortName", () => {
    expect(formatCardRewardValue(15, "points", null, 0.01)).toBe("1,500 pts");
  });
});

describe("formatPromotionValue", () => {
  it("formats points reward without shortName", () => {
    expect(
      formatPromotionValue({ rewardType: "points", bonusPointsApplied: 4200, appliedValue: 84 })
    ).toBe("4,200 pts");
  });
  it("formats points reward with shortName", () => {
    expect(
      formatPromotionValue(
        { rewardType: "points", bonusPointsApplied: 4200, appliedValue: 84 },
        "Hyatt"
      )
    ).toBe("4,200 Hyatt pts");
  });
  it("formats cashback reward", () => {
    expect(
      formatPromotionValue({ rewardType: "cashback", bonusPointsApplied: null, appliedValue: 84 })
    ).toBe("$84.00");
  });
  it("formats eqn reward", () => {
    expect(
      formatPromotionValue({ rewardType: "eqn", bonusPointsApplied: null, appliedValue: 20 })
    ).toBe("2 EQNs");
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
    ).toBe("5,000 pts");
  });
  it("reads rewardType from benefits for eqn", () => {
    expect(
      formatPromotionValue({
        promotion: { benefits: [{ rewardType: "eqn" }] },
        bonusPointsApplied: null,
        appliedValue: 60,
      })
    ).toBe("6 EQNs");
  });
});

describe("formatPortalValue", () => {
  it("formats cashback portals as USD", () => {
    expect(formatPortalValue(15, "cashback")).toBe("$15.00");
  });
  it("formats points portals with raw points count", () => {
    expect(formatPortalValue(0, "points", null, 1.2, 1500)).toBe("1,500 pts");
  });
  it("includes point type shortName", () => {
    expect(formatPortalValue(0, "points", "MR", 1.5, 2000)).toBe("2,000 MR pts");
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

describe("formatPartnershipValue", () => {
  it("formats points with shortName", () => {
    expect(formatPartnershipValue(476, "Qantas")).toBe("476 Qantas pts");
  });
  it("rounds fractional points", () => {
    expect(formatPartnershipValue(476.7, "Qantas")).toBe("477 Qantas pts");
  });
  it("formats large point counts with locale separators", () => {
    expect(formatPartnershipValue(12500, "Qantas")).toBe("12,500 Qantas pts");
  });
});
