import { describe, it, expect, vi } from "vitest";
import { getNetCostBreakdown } from "@/lib/net-cost";
import { calcTotalSavings } from "./page";

vi.mock("@/lib/net-cost", () => ({
  getNetCostBreakdown: vi.fn().mockReturnValue({
    promoSavings: 10,
    portalCashback: 5,
    cardReward: 8,
    loyaltyPointsValue: 12,
    bookingBenefitsValue: 25,
    cardBenefitSavings: 7,
    partnershipEarnsValue: 3,
  }),
}));

describe("calcTotalSavings", () => {
  it("includes all savings types in the total", () => {
    // 10 + 5 + 8 + 12 + 25 + 7 + 3 = 70
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = calcTotalSavings({} as any);
    expect(result).toBe(70);
    expect(getNetCostBreakdown).toHaveBeenCalledWith({});
  });
});
