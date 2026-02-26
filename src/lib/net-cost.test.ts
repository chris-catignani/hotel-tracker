import { describe, it, expect } from "vitest";
import { getNetCostBreakdown, NetCostBooking } from "./net-cost";

describe("net-cost", () => {
  const mockBaseBooking: NetCostBooking = {
    totalCost: 100,
    pretaxCost: 80,
    portalCashbackOnTotal: false,
    portalCashbackRate: null,
    loyaltyPointsEarned: null,
    pointsRedeemed: null,
    certificates: [],
    hotelChain: {
      name: "Test Hotel",
      loyaltyProgram: "Test Points",
      basePointRate: 10,
      pointType: { name: "Test Pts", centsPerPoint: 0.015 }, // non-default
    },
    creditCard: null,
    shoppingPortal: null,
    bookingPromotions: [],
  };

  it("should calculate base net cost correctly", () => {
    const result = getNetCostBreakdown(mockBaseBooking);
    expect(result.netCost).toBe(100);
    expect(result.promoSavings).toBe(0);
    expect(result.portalCashback).toBe(0);
  });

  it("should apply fixed cashback promotions", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 10,
          promotion: { name: "Promo 1", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 10,
              promotionBenefit: {
                rewardType: "cashback",
                valueType: "fixed",
                value: 10,
                certType: null,
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.promoSavings).toBe(10);
    expect(result.netCost).toBe(90);
    expect(result.promotions[0].formula).toContain("$10.00 fixed cashback = $10.00");
  });

  it("should apply percentage cashback promotions", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 20,
          promotion: { name: "20% off", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 20,
              promotionBenefit: {
                rewardType: "cashback",
                valueType: "percentage",
                value: 20,
                certType: null,
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.promoSavings).toBe(20);
    expect(result.netCost).toBe(80);
    expect(result.promotions[0].formula).toContain("$100.00 (total cost) × 20% = $20.00");
  });

  it("should apply points multiplier promotions (base_and_elite)", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      loyaltyPointsEarned: 1000,
      bookingPromotions: [
        {
          appliedValue: 15,
          promotion: { name: "2x multiplier", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 15,
              promotionBenefit: {
                rewardType: "points",
                valueType: "multiplier",
                value: 2,
                certType: null,
                pointsMultiplierBasis: "base_and_elite",
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    // (1000 earned * (2-1) = 1000 bonus pts) * 0.015 = $15.00
    expect(result.promoSavings).toBe(15);
    expect(result.netCost).toBe(70);
    expect(result.promotions[0].formula).toContain(
      "1,000 pts (incl. elite bonus) × (2 - 1) × 1.5¢ = $15.00"
    );
    expect(result.promotions[0].description).toContain("elite bonus");
  });

  it("should apply fixed points promotions", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 15,
          promotion: { name: "1000 bonus pts", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 15,
              promotionBenefit: {
                rewardType: "points",
                valueType: "fixed",
                value: 1000,
                certType: null,
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    // 1000 pts * 0.015 = $15.00
    expect(result.promoSavings).toBe(15);
    expect(result.netCost).toBe(85);
    expect(result.promotions[0].formula).toContain("1,000 bonus pts × 1.5¢ = $15.00");
  });

  it("should handle certificate benefit with valuation", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 525,
          promotion: { name: "Free Night Cert", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 525,
              promotionBenefit: {
                rewardType: "certificate",
                valueType: "fixed",
                value: 1,
                certType: "marriott_35k",
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    // marriott_35k = 35000 pts * 0.015 = 525
    expect(result.promoSavings).toBe(525);
    expect(result.netCost).toBe(-425); // 100 - 525
    expect(result.promotions[0].formula).toContain("35,000 pts × 1.5¢ = $525.00");
  });

  it("should handle EQN benefit with valuation", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 50,
          promotion: { name: "2 Bonus EQNs", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 50,
              promotionBenefit: {
                rewardType: "eqn",
                valueType: "fixed",
                value: 2,
                certType: null,
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    // 2 EQNs * $25.00 = $50.00
    expect(result.promoSavings).toBe(50);
    expect(result.netCost).toBe(50); // 100 - 50
    expect(result.promotions[0].formula).toContain("2 bonus EQN(s) × $25.00 = $50.00");
  });

  it("should sum multiple benefits across a promotion", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 25,
          promotion: { name: "Multi-benefit promo", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 10,
              promotionBenefit: {
                rewardType: "cashback",
                valueType: "fixed",
                value: 10,
                certType: null,
              },
            },
            {
              appliedValue: 15,
              promotionBenefit: {
                rewardType: "points",
                valueType: "fixed",
                value: 1000,
                certType: null,
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.promoSavings).toBe(25);
    expect(result.netCost).toBe(75);
    // Formula should include both benefit lines
    expect(result.promotions[0].formula).toContain("$10.00 fixed cashback");
    expect(result.promotions[0].formula).toContain("1,000 bonus pts");
    expect(result.promotions[0].formula).toContain("$25.00 total");
  });

  it("should calculate shopping portal cashback (pre-tax)", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 0.05,
      shoppingPortal: {
        name: "Rakuten",
        rewardType: "cash",
        pointType: null,
      },
    };
    const result = getNetCostBreakdown(booking);
    // 0.05 * 80 (pre-tax) = 4
    expect(result.portalCashback).toBe(4);
    expect(result.netCost).toBe(96);
    expect(result.portalCashbackCalc?.formula).toContain("$80.00 (pre-tax cost) × 5.0% = $4.00");
  });

  it("should calculate shopping portal cashback (total)", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 0.05,
      portalCashbackOnTotal: true,
      shoppingPortal: {
        name: "Rakuten",
        rewardType: "cash",
        pointType: null,
      },
    };
    const result = getNetCostBreakdown(booking);
    // 0.05 * 100 (total) = 5
    expect(result.portalCashback).toBe(5);
    expect(result.netCost).toBe(95);
    expect(result.portalCashbackCalc?.formula).toContain("$100.00 (total cost) × 5.0% = $5.00");
  });

  it("should calculate shopping portal points (valuation)", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 10, // 10 pts/$
      shoppingPortal: {
        name: "Chase Portal",
        rewardType: "points",
        pointType: { name: "Chase Pts", centsPerPoint: 0.015 },
      },
    };
    const result = getNetCostBreakdown(booking);
    // 80 pretax * 10 pts/$ * 0.015 $/pt = 12
    expect(result.portalCashback).toBe(12);
    expect(result.netCost).toBe(88);
    expect(result.portalCashbackCalc?.formula).toContain(
      "$80.00 (pre-tax cost) × 10 pts/$ × 1.5¢ = $12.00"
    );
  });

  it("should calculate credit card rewards", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      creditCard: {
        name: "Amex Plat",
        rewardRate: 5,
        pointType: { name: "MR Pts", centsPerPoint: 0.0125 },
      },
    };
    const result = getNetCostBreakdown(booking);
    // 100 total * 5 pts/$ * 0.0125 $/pt = 6.25
    expect(result.cardReward).toBe(6.25);
    expect(result.netCost).toBe(93.75);
    expect(result.cardRewardCalc?.formula).toContain("$100.00 (total cost) × 5x × 1.25¢ = $6.25");
  });

  it("should calculate loyalty points value", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      loyaltyPointsEarned: 2000,
    };
    const result = getNetCostBreakdown(booking);
    // 2000 earned * 0.015 = 30
    expect(result.loyaltyPointsValue).toBe(30);
    expect(result.netCost).toBe(70);
    expect(result.loyaltyPointsCalc?.formula).toContain("2,000 pts × 1.5¢ = $30.00");
  });

  it("should calculate points redeemed value", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      pointsRedeemed: 10000,
    };
    const result = getNetCostBreakdown(booking);
    // 10000 redeemed * 0.015 = 150
    // Net cost is 100 (total) + 150 (redeemed value) = 250
    expect(result.pointsRedeemedValue).toBe(150);
    expect(result.netCost).toBe(250);
    expect(result.pointsRedeemedCalc?.formula).toContain("10,000 pts × 1.5¢ = $150.00");
  });

  it("should calculate certificates value", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      certificates: [{ certType: "marriott_35k" }],
    };
    const result = getNetCostBreakdown(booking);
    // marriott_35k = 35000 pts * 0.015 = 525
    // Net cost is 100 (total) + 525 (cert value) = 625
    expect(result.certsValue).toBe(525);
    expect(result.netCost).toBe(625);
    expect(result.certsCalc?.formula).toContain("35,000 pts × 1.5¢ = $525.00");
  });

  it("should apply points multiplier with base_only basis", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      loyaltyPointsEarned: 800,
      bookingPromotions: [
        {
          appliedValue: 24,
          promotion: { name: "3x multiplier (base only)", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 24,
              promotionBenefit: {
                rewardType: "points",
                valueType: "multiplier",
                value: 3,
                certType: null,
                pointsMultiplierBasis: "base_only",
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    // basePoints = 80 (pretaxCost) * 10 (basePointRate) = 800
    // 800 pts * (3-1) * 0.015 = 24 (promo savings)
    // loyaltyPointsEarned = 800 * 0.015 = 12 (loyalty value)
    // netCost = 100 - 24 - 12 = 64
    expect(result.promoSavings).toBe(24);
    expect(result.netCost).toBe(64);
    expect(result.promotions[0].formula).toContain("(base rate only)");
    expect(result.promotions[0].description).toContain("base-rate points only");
  });
});
