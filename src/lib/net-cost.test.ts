import { describe, it, expect } from "vitest";
import { getNetCostBreakdown, NetCostBooking } from "./net-cost";
import { HotelChain } from "./types";

describe("net-cost", () => {
  const mockBaseBooking: NetCostBooking = {
    totalCost: 100,
    pretaxCost: 80,
    numNights: 3,
    portalCashbackOnTotal: false,
    portalCashbackRate: null,
    loyaltyPointsEarned: null,
    pointsRedeemed: null,
    certificates: [],
    hotelChainId: "test-hotel-id",
    otaAgencyId: null,
    hotelChain: {
      id: "test-hotel-id",
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
          appliedValue: 367.5,
          promotion: { name: "Free Night Cert", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 367.5,
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
    // marriott_35k = 35000 pts * 0.015 * 0.7 = 367.5
    expect(result.promoSavings).toBe(367.5);
    expect(result.netCost).toBe(-267.5); // 100 - 367.5
    expect(result.promotions[0].formula).toContain("35,000 pts × 70% × 1.5¢ = $367.50");
  });

  it("should handle EQN benefit with valuation", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 20,
          promotion: { name: "2 Bonus EQNs", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 20,
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
    // 2 EQNs * $10.00 = $20.00
    expect(result.promoSavings).toBe(20);
    expect(result.netCost).toBe(80); // 100 - 20
    expect(result.promotions[0].formula).toContain("2 bonus EQN(s) × $10.00 = $20.00");
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

  it("should calculate boosted credit card rewards for specific hotel chain", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      hotelChain: {
        ...mockBaseBooking.hotelChain,
        id: "hyatt-id", // mock id
      } as HotelChain,
      creditCard: {
        name: "Chase Hyatt",
        rewardRate: 1,
        pointType: { name: "Hyatt Pts", centsPerPoint: 0.015 },
        rewardRules: [
          {
            rewardType: "multiplier",
            rewardValue: 4,
            hotelChainId: "hyatt-id",
            otaAgencyId: null,
          },
        ],
      },
    };
    const result = getNetCostBreakdown(booking);
    // 100 total * 4x (boosted) * 0.015 $/pt = 6.00
    expect(result.cardReward).toBe(6.0);
    expect(result.cardRewardCalc?.formula).toContain("4x (boosted)");
    expect(result.cardRewardCalc?.description).toContain("boosted total of 4x");
  });

  it("should calculate boosted credit card rewards for specific OTA", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      otaAgencyId: "chase-ota-id",
      creditCard: {
        name: "Chase Sapphire Reserve",
        rewardRate: 4,
        pointType: { name: "UR Pts", centsPerPoint: 0.015 },
        rewardRules: [
          {
            rewardType: "multiplier",
            rewardValue: 10,
            hotelChainId: null,
            otaAgencyId: "chase-ota-id",
          },
        ],
      },
    };
    const result = getNetCostBreakdown(booking);
    // 100 total * 10x (boosted) * 0.015 $/pt = 15.00
    expect(result.cardReward).toBe(15.0);
    expect(result.cardRewardCalc?.formula).toContain("10x (boosted)");
    expect(result.cardRewardCalc?.description).toContain("boosted total of 10x");
  });

  it("should calculate fixed bonus credit card rewards", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      hotelChain: {
        ...mockBaseBooking.hotelChain,
        id: "marriott-id",
      } as HotelChain,
      creditCard: {
        name: "Marriott Bevy",
        rewardRate: 2,
        pointType: { name: "Bonvoy Pts", centsPerPoint: 0.007 },
        rewardRules: [
          {
            rewardType: "fixed",
            rewardValue: 1000,
            hotelChainId: "marriott-id",
            otaAgencyId: null,
          },
        ],
      },
    };
    const result = getNetCostBreakdown(booking);
    // base: 100 total * 2x * 0.007 = 1.40
    // bonus: 1000 pts * 0.007 = 7.00
    // total: 1.40 + 7.00 = 8.40
    expect(result.cardReward).toBeCloseTo(8.4, 2);
    expect(result.cardRewardCalc?.formula).toContain("1,000 bonus pts × 0.7¢ = $8.40");
    expect(result.cardRewardCalc?.description).toContain("plus a fixed bonus of 1,000");
  });

  it("should stack boosted multipliers and fixed bonuses", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      hotelChain: {
        ...mockBaseBooking.hotelChain,
        id: "marriott-id",
      } as HotelChain,
      creditCard: {
        name: "Marriott Bevy Boosted",
        rewardRate: 2,
        pointType: { name: "Bonvoy Pts", centsPerPoint: 0.007 },
        rewardRules: [
          {
            rewardType: "multiplier",
            rewardValue: 6, // Boosted to 6x
            hotelChainId: "marriott-id",
            otaAgencyId: null,
          },
          {
            rewardType: "fixed",
            rewardValue: 1000, // Plus 1000 bonus
            hotelChainId: "marriott-id",
            otaAgencyId: null,
          },
        ],
      },
    };
    const result = getNetCostBreakdown(booking);
    // boosted base: 100 total * 6x * 0.007 = 4.20
    // fixed bonus: 1000 pts * 0.007 = 7.00
    // total: 4.20 + 7.00 = 11.20
    expect(result.cardReward).toBeCloseTo(11.2, 2);
    expect(result.cardRewardCalc?.formula).toContain("($100.00 × 6x) + 1,000 bonus pts");
    expect(result.cardRewardCalc?.description).toContain(
      "boosted 6x Bonvoy Pts plus a fixed bonus of 1,000"
    );
  });

  it("should ignore hotel chain boost if booking is via a different OTA", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      otaAgencyId: "some-other-ota",
      hotelChain: {
        ...mockBaseBooking.hotelChain,
        id: "marriott-id",
      } as HotelChain,
      creditCard: {
        name: "Marriott Card",
        rewardRate: 2,
        pointType: { name: "Bonvoy Pts", centsPerPoint: 0.007 },
        rewardRules: [
          {
            rewardType: "multiplier",
            rewardValue: 6,
            hotelChainId: "marriott-id",
            otaAgencyId: null,
          },
        ],
      },
    };
    const result = getNetCostBreakdown(booking);
    // Should NOT get 6x because it's an OTA booking.
    // Fallback to base 2x: 100 total * 2x * 0.007 = 1.40
    expect(result.cardReward).toBeCloseTo(1.4, 2);
    expect(result.cardRewardCalc?.formula).toContain("2x");
    expect(result.cardRewardCalc?.formula).not.toContain("6x");
  });

  it("should explain benefit-level stacking (multiplier) in the formula", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 20,
          promotion: { name: "Stacked Promo", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 20,
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
    expect(result.promotions[0].formula).toContain("2 × $10.00 fixed cashback = $20.00");
    expect(result.promotions[0].description).toContain("Earning 2x of a fixed cashback");
  });

  it("should explain benefit-level capping in the formula", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 15,
          promotion: { name: "Capped Promo", benefits: [] },
          benefitApplications: [
            {
              appliedValue: 15,
              promotionBenefit: {
                rewardType: "cashback",
                valueType: "fixed",
                value: 20,
                certType: null,
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.promotions[0].formula).toContain("$20.00 fixed cashback (capped) = $15.00");
    expect(result.promotions[0].description).toContain("reduced by redemption caps");
  });

  it("should explain pending spanned promotion in the formula and description", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      numNights: 1,
      bookingPromotions: [
        {
          appliedValue: 10,
          eligibleNightsAtBooking: 1,
          promotion: {
            name: "Spanned Promo",
            restrictions: { minNightsRequired: 3, spanStays: true },
            benefits: [],
          },
          benefitApplications: [
            {
              appliedValue: 10,
              eligibleNightsAtBooking: 1,
              promotionBenefit: {
                rewardType: "cashback",
                valueType: "fixed",
                value: 30,
                certType: null,
              },
            },
          ],
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.promotions[0].formula).toContain(
      "(1 of 3 nights) × $30.00 fixed cashback (pending) = $10.00"
    );
    expect(result.promotions[0].description).toContain(
      "This bonus is pending additional stays (1 of 3 nights required)"
    );
  });
});
