import { describe, it, expect } from "vitest";
import { getNetCostBreakdown, toUSD, NetCostBooking } from "./net-cost";
import { HotelChain } from "./types";

describe("net-cost", () => {
  const mockBaseBooking: NetCostBooking = {
    hotelChainId: "h1",
    numNights: 1,
    pretaxCost: 80,
    totalCost: 100,
    loyaltyPointsEarned: 0,
    pointsRedeemed: null,
    hotelChain: {
      id: "h1",
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: 10,
      pointType: { name: "Hyatt Points", centsPerPoint: 0.015 },
    } as HotelChain,
    portalCashbackOnTotal: false,
    portalCashbackRate: 0,
    certificates: [],
    otaAgencyId: null,
    bookingSource: null,
    creditCard: null,
    shoppingPortal: null,
    bookingPromotions: [],
  };

  it("should calculate base net cost correctly", () => {
    const result = getNetCostBreakdown(mockBaseBooking);
    expect(result.totalCost).toBe(100);
    expect(result.netCost).toBe(100);
    expect(result.promoSavings).toBe(0);
    expect(result.portalCashback).toBe(0);
  });

  describe("toUSD helper", () => {
    it("returns amount unchanged when rate is 1 (USD)", () => {
      expect(toUSD(100, 1)).toBe(100);
    });

    it("converts native amount to USD using exchange rate", () => {
      expect(toUSD(1000, 0.00073)).toBeCloseTo(0.73);
    });
  });

  describe("Non-USD currency calculations (exchangeRate applied)", () => {
    // EUR booking: pretax=800 EUR, total=1000 EUR, rate=1.08 → pretax=$864, total=$1080 USD
    const eurBooking: NetCostBooking = {
      ...mockBaseBooking,
      currency: "EUR",
      exchangeRate: 1.08,
      pretaxCost: 800,
      totalCost: 1000,
      loyaltyPointsEarned: 0,
    };

    it("converts totalCost to USD for netCost calculation", () => {
      const result = getNetCostBreakdown(eurBooking);
      expect(result.totalCost).toBeCloseTo(1080); // 1000 EUR * 1.08
      expect(result.netCost).toBeCloseTo(1080);
    });

    it("applies portal cashback on USD-converted pre-tax cost", () => {
      const booking: NetCostBooking = {
        ...eurBooking,
        shoppingPortal: { name: "Rakuten", rewardType: "cashback", pointType: null },
        portalCashbackRate: 0.05, // 5%
        portalCashbackOnTotal: false,
      };
      // pretax USD = 800 * 1.08 = 864; cashback = 864 * 0.05 = 43.20
      const result = getNetCostBreakdown(booking);
      expect(result.portalCashback).toBeCloseTo(43.2);
      expect(result.netCost).toBeCloseTo(1080 - 43.2);
    });

    it("applies portal cashback on USD-converted total cost when portalCashbackOnTotal=true", () => {
      const booking: NetCostBooking = {
        ...eurBooking,
        shoppingPortal: { name: "Rakuten", rewardType: "cashback", pointType: null },
        portalCashbackRate: 0.1, // 10%
        portalCashbackOnTotal: true,
      };
      // total USD = 1000 * 1.08 = 1080; cashback = 1080 * 0.1 = 108
      const result = getNetCostBreakdown(booking);
      expect(result.portalCashback).toBeCloseTo(108);
    });

    it("applies card reward on USD-converted total cost", () => {
      const booking: NetCostBooking = {
        ...eurBooking,
        creditCard: {
          name: "Chase Sapphire",
          rewardRate: 0.01,
          pointType: { name: "Ultimate Rewards", centsPerPoint: 0.02 },
        },
      };
      // total USD = 1080; reward = 1080 * 0.01 * 0.02 = 0.216
      const result = getNetCostBreakdown(booking);
      expect(result.cardReward).toBeCloseTo(0.216);
    });

    it("treats null exchangeRate as 1 (USD fallback) for cost calculations", () => {
      const booking: NetCostBooking = {
        ...mockBaseBooking,
        currency: "SGD",
        exchangeRate: null,
        pretaxCost: 500,
        totalCost: 600,
      };
      const result = getNetCostBreakdown(booking);
      // exchangeRate defaults to 1 → costs treated as-is
      expect(result.totalCost).toBe(600);
    });
  });

  it("should apply fixed cashback promotions", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [
        {
          appliedValue: 10,
          promotion: { name: "Fixed Promo", benefits: [] },
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain("$10.00 fixed cashback = $10.00");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain("$100.00 (total cost) × 20% = $20.00");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain(
      "1,000 pts (incl. elite bonus) × (2 - 1) × 1.5¢ = $15.00"
    );
    expect(promo.groups[0].description).toContain("loyalty points");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain("1,000 bonus pts × 1.5¢ = $15.00");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain("35,000 pts × 70% × 1.5¢ = $367.50");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain("2 bonus EQN(s) × $10.00 = $20.00");
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
    const promo = result.promotions[0];
    // Formula should include both benefits in their groups
    expect(promo.groups).toHaveLength(2);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[1].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain("$10.00 fixed cashback");
    expect(promo.groups[1].segments[0].formula).toContain("1,000 bonus pts");
  });

  it("should calculate shopping portal cashback (pre-tax)", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 0.05,
      shoppingPortal: {
        name: "Rakuten",
        rewardType: "cashback",
        pointType: null,
      },
    };
    const result = getNetCostBreakdown(booking);
    // 0.05 * 80 (pre-tax) = 4
    expect(result.portalCashback).toBe(4);
    expect(result.netCost).toBe(96);
    expect(result.portalCashbackCalc?.groups).toHaveLength(1);
    expect(result.portalCashbackCalc?.groups[0].segments).toHaveLength(1);
    expect(result.portalCashbackCalc?.groups[0].segments[0].formula).toContain(
      "$80.00 (pre-tax cost) × 5.0% = $4.00"
    );
  });

  it("should calculate shopping portal cashback (total)", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackOnTotal: true,
      portalCashbackRate: 0.05,
      shoppingPortal: {
        name: "Rakuten",
        rewardType: "cashback",
        pointType: null,
      },
    };
    const result = getNetCostBreakdown(booking);
    // 0.05 * 100 (total) = 5
    expect(result.portalCashback).toBe(5);
    expect(result.netCost).toBe(95);
    expect(result.portalCashbackCalc?.groups).toHaveLength(1);
    expect(result.portalCashbackCalc?.groups[0].segments).toHaveLength(1);
    expect(result.portalCashbackCalc?.groups[0].segments[0].formula).toContain(
      "$100.00 (total cost) × 5.0% = $5.00"
    );
  });

  it("should calculate shopping portal points (valuation)", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 10,
      shoppingPortal: {
        name: "Rakuten",
        rewardType: "points",
        pointType: { name: "Amex Points", centsPerPoint: 0.015 },
      },
    };
    const result = getNetCostBreakdown(booking);
    // 80 pretax * 10 pts/$ * 0.015 $/pt = 12
    expect(result.portalCashback).toBe(12);
    expect(result.netCost).toBe(88);
    expect(result.portalCashbackCalc?.groups).toHaveLength(1);
    expect(result.portalCashbackCalc?.groups[0].segments).toHaveLength(1);
    expect(result.portalCashbackCalc?.groups[0].segments[0].formula).toContain(
      "$80.00 (pre-tax cost) × 10 pts/$ × 1.5¢ = $12.00"
    );
  });

  it("should calculate credit card rewards", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      creditCard: {
        name: "Chase Sapphire",
        rewardRate: 4,
        pointType: { name: "UR Points", centsPerPoint: 0.015 },
        rewardRules: [],
      },
    };
    const result = getNetCostBreakdown(booking);
    // 100 total * 4 pts/$ * 0.015 $/pt = 6.00
    expect(result.cardReward).toBe(6.0);
    expect(result.netCost).toBe(94.0);
    expect(result.cardRewardCalc?.groups).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments[0].formula).toContain(
      "$100.00 (total cost) × 4x × 1.5¢ = $6.00"
    );
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
    expect(result.loyaltyPointsCalc?.groups).toHaveLength(1);
    expect(result.loyaltyPointsCalc?.groups[0].segments).toHaveLength(1);
    expect(result.loyaltyPointsCalc?.groups[0].segments[0].formula).toContain(
      "2,000 pts × 1.5¢ = $30.00"
    );
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
    expect(result.pointsRedeemedCalc?.groups).toHaveLength(1);
    expect(result.pointsRedeemedCalc?.groups[0].segments).toHaveLength(1);
    expect(result.pointsRedeemedCalc?.groups[0].segments[0].formula).toContain(
      "10,000 pts × 1.5¢ = $150.00"
    );
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
    expect(result.certsCalc?.groups).toHaveLength(1);
    expect(result.certsCalc?.groups[0].segments).toHaveLength(1);
    expect(result.certsCalc?.groups[0].segments[0].formula).toContain(
      "35,000 pts × 1.5¢ = $525.00"
    );
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
    expect(result.promotions[0].groups).toHaveLength(1);
    expect(result.promotions[0].groups[0].segments).toHaveLength(1);
    expect(result.promotions[0].groups[0].segments[0].formula).toContain("(base rate only)");
    expect(result.promotions[0].groups[0].description).toContain("base rate");
  });

  it("should calculate boosted credit card rewards for specific hotel chain", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      hotelChain: {
        ...mockBaseBooking.hotelChain,
        id: "hyatt-id",
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
    expect(result.cardRewardCalc?.groups).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments).toHaveLength(2);
    expect(result.cardRewardCalc?.groups[0].segments[0].formula).toContain(
      "$100.00 (total cost) × 1x × 1.5¢ = $1.50"
    );
    expect(result.cardRewardCalc?.groups[0].segments[1].formula).toContain(
      "$100.00 (total cost) × 3x boost × 1.5¢ = $4.50"
    );
    expect(result.cardRewardCalc?.description).toContain(
      "Total rewards earned using your Chase Hyatt"
    );
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
    expect(result.cardRewardCalc?.groups).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments).toHaveLength(2);
    expect(result.cardRewardCalc?.groups[0].segments[0].formula).toContain(
      "$100.00 (total cost) × 4x × 1.5¢ = $6.00"
    );
    expect(result.cardRewardCalc?.groups[0].segments[1].formula).toContain(
      "$100.00 (total cost) × 6x boost × 1.5¢ = $9.00"
    );
  });

  it("should calculate fixed bonus credit card rewards", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      creditCard: {
        name: "Amex Plat",
        rewardRate: 2,
        pointType: { name: "MR Pts", centsPerPoint: 0.007 },
        rewardRules: [
          {
            rewardType: "fixed",
            rewardValue: 1000,
            hotelChainId: "h1",
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
    expect(result.cardRewardCalc?.groups).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments).toHaveLength(2);
    expect(result.cardRewardCalc?.groups[0].segments[1].formula).toContain(
      "1,000 bonus pts × 0.7¢ = $7.00"
    );
    expect(result.cardRewardCalc?.groups[0].segments[1].label).toBe("Fixed Card Bonus");
  });

  it("should stack boosted multipliers and fixed bonuses", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      hotelChainId: "h1",
      hotelChain: { ...mockBaseBooking.hotelChain, id: "h1" } as HotelChain,
      creditCard: {
        name: "Amex Plat",
        rewardRate: 2,
        pointType: { name: "MR Pts", centsPerPoint: 0.007 },
        rewardRules: [
          {
            rewardType: "multiplier",
            rewardValue: 6,
            hotelChainId: "h1",
            otaAgencyId: null,
          },
          {
            rewardType: "fixed",
            rewardValue: 1000,
            hotelChainId: "h1",
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
    expect(result.cardRewardCalc?.groups).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments).toHaveLength(3);
    expect(result.cardRewardCalc?.groups[0].segments[1].formula).toContain("4x boost");
    expect(result.cardRewardCalc?.groups[0].segments[2].label).toBe("Fixed Card Bonus");
  });

  it("should ignore hotel chain boost if booking is via a different OTA", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      otaAgencyId: "expedia",
      hotelChainId: "h1",
      hotelChain: { ...mockBaseBooking.hotelChain, id: "h1" } as HotelChain,
      creditCard: {
        name: "Amex Plat",
        rewardRate: 2,
        pointType: { name: "MR Pts", centsPerPoint: 0.007 },
        rewardRules: [
          {
            rewardType: "multiplier",
            rewardValue: 6,
            hotelChainId: "h1",
            otaAgencyId: null, // Only for direct bookings
          },
        ],
      },
    };
    const result = getNetCostBreakdown(booking);
    // Should NOT get 6x because it's an OTA booking.
    // Fallback to base 2x: 100 total * 2x * 0.007 = 1.40
    expect(result.cardReward).toBeCloseTo(1.4, 2);
    expect(result.cardRewardCalc?.groups).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments).toHaveLength(1);
    expect(result.cardRewardCalc?.groups[0].segments[0].formula).not.toContain("6x");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain("2 × $10.00 fixed cashback = $20.00");
    expect(promo.groups[0].description).toContain("Earning 2x of a fixed cashback");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain(
      "$20.00 fixed cashback (capped) = $15.00"
    );
    expect(promo.groups[0].description).toContain("Reduced by redemption caps");
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
    const promo = result.promotions[0];
    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(1);
    expect(promo.groups[0].segments[0].formula).toContain(
      "(1 of 3 nights) × $30.00 fixed cashback = $10.00 (pending)"
    );
    expect(promo.groups[0].description).toContain(
      "This bonus is pending additional stays (1 of 3 nights required)"
    );
  });

  it("should provide segments for a complex multi-night spanned stay", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      numNights: 4,
      bookingPromotions: [
        {
          appliedValue: 40,
          eligibleNightsAtBooking: 4,
          promotion: {
            name: "Spanned Promo",
            restrictions: { minNightsRequired: 3, spanStays: true },
            benefits: [],
          },
          benefitApplications: [
            {
              appliedValue: 40,
              eligibleNightsAtBooking: 4,
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
    const promo = result.promotions[0];

    expect(promo.groups).toHaveLength(1);
    expect(promo.groups[0].segments).toHaveLength(2);
    expect(promo.groups[0].segments[0].label).toBe("Full Reward Cycle (3/3 nights)");
    expect(promo.groups[0].segments[0].value).toBe(30);
    expect(promo.groups[0].segments[1].label).toBe("New Reward Cycle (1/3 nights)");
    expect(promo.groups[0].segments[1].value).toBe(10);
    expect(promo.groups[0].segments[1].formula).toContain("(pending)");
  });

  it("should provide segments for credit card rewards with hotel boost", () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      hotelChain: {
        ...mockBaseBooking.hotelChain,
        id: "hyatt-id",
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
    const card = result.cardRewardCalc;

    expect(card?.groups).toHaveLength(1);
    expect(card?.groups[0].segments).toHaveLength(2);
    expect(card?.groups[0].segments[0].label).toBe("Base Card Earning");
    expect(card?.groups[0].segments[1].label).toBe("Hotel/Booking Boost");
    expect(card?.groups[0].segments[0].value).toBe(1.5);
    expect(card?.groups[0].segments[1].value).toBe(4.5);
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  describe("Span-stays Orphaned vs Capped partial cycles (Issue #170)", () => {
    // Shared setup: 7-night booking, 3-night cycle, 3000-point benefit, centsPerPoint=0.02
    // cumulativeAtStart=0, cumulativeAtEnd=7
    // Segments: [0-3 complete=$60, 3-6 complete=$60, 6-7 orphaned partial=$0]
    const makeSpanBooking = (
      eligibleNightsAtBooking: number,
      bApplied: number,
      maxTotalBonusPoints: number | null,
      isOrphaned = true
    ): NetCostBooking => ({
      ...mockBaseBooking,
      hotelChain: {
        ...mockBaseBooking.hotelChain,
        pointType: { name: "Test Pts", centsPerPoint: 0.02 },
      } as typeof mockBaseBooking.hotelChain,
      numNights: 7,
      bookingPromotions: [
        {
          id: "bp-span",
          promotionId: "p-span",
          promotion: {
            name: "Span Promo",
            restrictions: { spanStays: true, minNightsRequired: 3 } as any,
          } as any,
          appliedValue: bApplied,
          isOrphaned,
          eligibleNightsAtBooking,
          benefitApplications: [
            {
              promotionBenefit: {
                rewardType: "points",
                valueType: "fixed",
                value: 3000,
                restrictions: {
                  spanStays: true,
                  minNightsRequired: 3,
                  maxTotalBonusPoints,
                } as any,
              } as any,
              appliedValue: bApplied,
              eligibleNightsAtBooking,
              isOrphaned,
            },
          ] as any[],
        },
      ],
    });

    it("orphaned partial cycle — cap NOT exhausted → labeled 'Orphaned Reward Cycle'", () => {
      // cumulativeAtEnd=7, floor(7/3)=2 cycles × 3000pts=6000 < cap of 21000 → cap NOT hit
      // bApplied = 2 × 3000 × 0.02 = $120 (completed cycles only, isRemainderOrphaned)
      const booking = makeSpanBooking(7, 120, 21000, true);
      const breakdown = getNetCostBreakdown(booking);
      const segments = breakdown.promotions[0].groups[0].segments;

      // 3 segments: 2 complete + 1 orphaned
      expect(segments).toHaveLength(3);
      expect(segments[0].label).toBe("Full Reward Cycle (3/3 nights)");
      expect(segments[0].value).toBe(60);
      expect(segments[1].label).toBe("Full Reward Cycle (3/3 nights)");
      expect(segments[1].value).toBe(60);
      // Orphaned partial: cap not exhausted → "Orphaned", not "Capped"
      expect(segments[2].label).toBe("Orphaned Reward Cycle (1/3 nights)");
      expect(segments[2].value).toBe(0);
      expect(segments[2].formula).toContain("(orphaned)");
    });

    it("partial cycle — cap IS exhausted by completed cycles → labeled 'Capped Reward Cycle'", () => {
      // cumulativeAtEnd=22 (prior=15 + this=7), floor(22/3)=7 cycles × 3000pts=21000 = cap of 21000
      // bApplied = 2 × 3000 × 0.02 = $120 (only THIS booking's 2 cycles; prior cycles are in prior bookings)
      const booking = makeSpanBooking(22, 120, 21000, true);
      const breakdown = getNetCostBreakdown(booking);
      const segments = breakdown.promotions[0].groups[0].segments;

      // 3 segments: cycle-completion + full cycle + capped partial
      expect(segments).toHaveLength(3);
      // Last segment: cap IS exhausted (floor(22/3)*3000=21000 >= 21000) → "Capped"
      expect(segments[2].label).toBe("Capped Reward Cycle (1/3 nights)");
      expect(segments[2].value).toBe(0);
      expect(segments[2].formula).toBe("");
      expect(segments[2].description).toBe(
        "This segment no longer applies because the promotion has been maxed out."
      );
    });

    it("no maxTotalBonusPoints restriction → orphaned partial always shows as Orphaned", () => {
      // Even if prior cycles exhausted budget, without a cap the partial cycle is Orphaned
      const booking = makeSpanBooking(7, 120, null, true);
      const breakdown = getNetCostBreakdown(booking);
      const segments = breakdown.promotions[0].groups[0].segments;
      expect(segments[2].label).toBe("Orphaned Reward Cycle (1/3 nights)");
    });

    it("isOrphaned=false, cap NOT exhausted → $0 partial cycle shows as Orphaned not Capped", () => {
      // This is the regression case: bApplied exhausted by 2 complete cycles, 1 night remainder.
      // isOrphaned=false on the booking promotion, but cap (21000 pts) is far from exhausted
      // (floor(7/3) × 3000 = 6000 < 21000). The partial cycle must show as Orphaned, not Capped.
      const booking = makeSpanBooking(7, 120, 21000, false);
      const breakdown = getNetCostBreakdown(booking);
      const segments = breakdown.promotions[0].groups[0].segments;

      expect(segments).toHaveLength(3);
      expect(segments[0].label).toBe("Full Reward Cycle (3/3 nights)");
      expect(segments[1].label).toBe("Full Reward Cycle (3/3 nights)");
      expect(segments[2].label).toBe("Orphaned Reward Cycle (1/3 nights)");
      expect(segments[2].value).toBe(0);
      expect(segments[2].formula).toContain("(orphaned)");
    });

    it("isOrphaned=false, no cap → $0 partial cycle is Maxed Out (bApplied exhausted)", () => {
      // Without a cap and isOrphaned=false, a $0 partial cycle means bApplied ran out → Maxed Out.
      // Label is "Capped Reward Cycle" because the segment is capped by the exhausted bApplied budget.
      const booking = makeSpanBooking(7, 120, null, false);
      const breakdown = getNetCostBreakdown(booking);
      const segments = breakdown.promotions[0].groups[0].segments;

      expect(segments[2].label).toBe("Capped Reward Cycle (1/3 nights)");
      expect(segments[2].value).toBe(0);
      expect(segments[2].formula).toBe("");
      expect(segments[2].description).toBe(
        "This segment no longer applies because the promotion has been maxed out."
      );
    });
  });

  describe("Capped and Maxed Out Promotions (Issue #157)", () => {
    it("should omit formula and show maxed out message for spanned reward when value is 0", () => {
      const booking: NetCostBooking = {
        ...mockBaseBooking,
        numNights: 3,
        bookingPromotions: [
          {
            id: "bp1",
            promotionId: "p1",
            promotion: {
              name: "Hyatt Promo",
              restrictions: { spanStays: true, minNightsRequired: 3 } as unknown as any,
            } as any,
            appliedValue: 0,
            benefitApplications: [
              {
                promotionBenefit: {
                  rewardType: "points",
                  valueType: "fixed",
                  value: 3000,
                } as any,
                appliedValue: 0,
                eligibleNightsAtBooking: 3,
              },
            ] as any[],
          },
        ],
      };

      const breakdown = getNetCostBreakdown(booking);
      const promo = breakdown.promotions[0];
      expect(promo.groups).toHaveLength(1);
      const segment = promo.groups[0].segments[0];

      expect(segment.value).toBe(0);
      expect(segment.formula).toBe("");
      expect(segment.description).toBe(
        "This segment no longer applies because the promotion has been maxed out."
      );
      expect(promo.groups[0].description).toBe(
        "This promotion has been maxed out and no further rewards apply."
      );
    });

    it("should reward first cycles fully and cap the remaining nights ('split the pot')", () => {
      // Stay: 9 nights. Remaining capacity: $120 (6000 pts).
      // Cycle 1 (nights 5-6): 2/3 nights -> $40 (Full)
      // Cycle 2 (nights 7-9): 3/3 nights -> $60 (Full)
      // Cycle 3 (nights 10-12): 3/3 nights -> $20 (Capped)
      // Cycle 4 (night 13): 1/3 nights -> $0 (Maxed Out)
      const booking: NetCostBooking = {
        ...mockBaseBooking,
        hotelChain: {
          ...mockBaseBooking.hotelChain,
          pointType: { name: "Test Pts", centsPerPoint: 0.02 },
        } as unknown as any,
        numNights: 9,
        bookingPromotions: [
          {
            id: "bp2",
            promotionId: "p2",
            promotion: {
              name: "Hyatt Promo",
              restrictions: { spanStays: true, minNightsRequired: 3 } as unknown as any,
            } as any,
            appliedValue: 120,
            benefitApplications: [
              {
                promotionBenefit: {
                  rewardType: "points",
                  valueType: "fixed",
                  value: 3000,
                } as any,
                appliedValue: 120,
                eligibleNightsAtBooking: 13,
              },
            ] as any[],
          },
        ],
      };

      const breakdown = getNetCostBreakdown(booking);
      const promo = breakdown.promotions[0];

      expect(promo.groups).toHaveLength(1);
      expect(promo.groups[0].segments).toHaveLength(4);

      // Cycle 1: Completion (2 nights) -> $40
      expect(promo.groups[0].segments[0].value).toBe(40);
      expect(promo.groups[0].segments[0].label).toContain("Cycle Completion");

      // Cycle 2: Full (3 nights) -> $60
      expect(promo.groups[0].segments[1].value).toBe(60);
      expect(promo.groups[0].segments[1].label).toContain("Full Reward Cycle");

      // Cycle 3: Full (3 nights) -> $20 (Capped)
      expect(promo.groups[0].segments[2].value).toBe(20);
      expect(promo.groups[0].segments[2].formula).toContain("(capped)");

      // Cycle 4: Start (1 night) -> $0 (Maxed Out)
      expect(promo.groups[0].segments[3].value).toBe(0);
      expect(promo.groups[0].segments[3].formula).toBe("");
      expect(promo.groups[0].segments[3].description).toBe(
        "This segment no longer applies because the promotion has been maxed out."
      );
    });
  });

  describe("pre-qualifying promotions", () => {
    const preQualifyingBase = {
      ...mockBaseBooking,
      numNights: 2,
    };

    describe("prerequisite stay count", () => {
      it("shows fulfilled message when this booking completes the prerequisite", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          bookingPromotions: [
            {
              appliedValue: 0,
              isPreQualifying: true,
              eligibleStayCount: 1, // this booking is stay #1, prior = 0
              eligibleNightCount: 2,
              promotion: {
                name: "Test Prereq Promo",
                restrictions: { prerequisiteStayCount: 1 },
                benefits: [],
              },
              benefitApplications: [],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const prereqGroup = promo.groups.find((g) => g.name === "Prerequisite Stays");

        expect(prereqGroup).toBeDefined();
        expect(prereqGroup!.description).toContain("1 pre-qualifying stay");
        expect(prereqGroup!.segments[0].hideValue).toBe(true);
        expect(prereqGroup!.segments[0].formula).toContain("1 of 1 pre-qualifying stays complete");
        expect(prereqGroup!.segments[0].formula).toContain("this booking is #1");
        expect(prereqGroup!.segments[0].description).toContain(
          "This booking fulfills the prerequisite"
        );
      });

      it("shows remaining count when more stays are needed after this booking", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          bookingPromotions: [
            {
              appliedValue: 0,
              isPreQualifying: true,
              eligibleStayCount: 1, // stay #1, need 2 total
              eligibleNightCount: 2,
              promotion: {
                name: "Test Prereq Promo",
                restrictions: { prerequisiteStayCount: 2 },
                benefits: [],
              },
              benefitApplications: [],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const prereqGroup = promo.groups.find((g) => g.name === "Prerequisite Stays");

        expect(prereqGroup).toBeDefined();
        expect(prereqGroup!.description).toContain("2 pre-qualifying stays");
        expect(prereqGroup!.segments[0].hideValue).toBe(true);
        expect(prereqGroup!.segments[0].formula).toContain("1 of 2 stays complete");
        expect(prereqGroup!.segments[0].formula).toContain("1 more needed");
        expect(prereqGroup!.segments[0].description).toContain(
          "1 more qualifying stay after this one"
        );
      });
    });

    describe("prerequisite night count", () => {
      it("shows fulfilled message when this booking completes the prerequisite nights", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          numNights: 3,
          bookingPromotions: [
            {
              appliedValue: 0,
              isPreQualifying: true,
              eligibleStayCount: 1,
              eligibleNightCount: 3,
              promotion: {
                name: "Test Night Prereq",
                restrictions: { prerequisiteNightCount: 3 },
                benefits: [],
              },
              benefitApplications: [],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const prereqGroup = promo.groups.find((g) => g.name === "Prerequisite Nights");

        expect(prereqGroup).toBeDefined();
        expect(prereqGroup!.segments[0].formula).toContain("3 of 3 pre-qualifying nights complete");
        expect(prereqGroup!.segments[0].formula).toContain("this booking adds 3");
        expect(prereqGroup!.segments[0].description).toContain(
          "This booking fulfills the prerequisite"
        );
      });

      it("shows remaining count when more nights are needed", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          numNights: 2,
          bookingPromotions: [
            {
              appliedValue: 0,
              isPreQualifying: true,
              eligibleStayCount: 1,
              eligibleNightCount: 2,
              promotion: {
                name: "Test Night Prereq",
                restrictions: { prerequisiteNightCount: 5 },
                benefits: [],
              },
              benefitApplications: [],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const prereqGroup = promo.groups.find((g) => g.name === "Prerequisite Nights");

        expect(prereqGroup).toBeDefined();
        expect(prereqGroup!.segments[0].formula).toContain("2 of 5 nights complete");
        expect(prereqGroup!.segments[0].formula).toContain("3 more needed");
      });
    });

    describe("upcoming tiers for actively-earning tiered promotions", () => {
      const tieredPromo = {
        name: "GHA Multi Brand",
        restrictions: null,
        benefits: [],
        tiers: [
          {
            minStays: 2,
            maxStays: 2,
            minNights: null,
            maxNights: null,
            benefits: [{ rewardType: "points", valueType: "fixed", value: "5000", certType: null }],
          },
          {
            minStays: 3,
            maxStays: 3,
            minNights: null,
            maxNights: null,
            benefits: [{ rewardType: "points", valueType: "fixed", value: "7500", certType: null }],
          },
          {
            minStays: 4,
            maxStays: null,
            minNights: null,
            maxNights: null,
            benefits: [
              { rewardType: "points", valueType: "fixed", value: "10000", certType: null },
            ],
          },
        ],
      };

      it("shows upcoming tiers when on an intermediate tier", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          bookingPromotions: [
            {
              appliedValue: 50,
              isPreQualifying: false,
              isOrphaned: false,
              eligibleStayCount: 2, // stay #2 — earning tier 1
              eligibleNightCount: 4,
              promotion: tieredPromo,
              benefitApplications: [
                {
                  appliedValue: 50,
                  promotionBenefit: {
                    rewardType: "points",
                    valueType: "fixed",
                    value: "5000",
                    certType: null,
                  },
                },
              ],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const upcomingGroup = promo.groups.find((g) => g.name === "Upcoming Tiers");

        expect(upcomingGroup).toBeDefined();
        expect(upcomingGroup!.segments).toHaveLength(2); // tier 2 and tier 3

        // First future tier labelled "Next:"
        expect(upcomingGroup!.segments[0].label).toBe("Next: Stay 3");
        expect(upcomingGroup!.segments[0].formula).toContain("7,500 pts");
        expect(upcomingGroup!.segments[0].hideValue).toBe(true);

        // Second future tier
        expect(upcomingGroup!.segments[1].label).toBe("Stay 4+");
        expect(upcomingGroup!.segments[1].formula).toContain("10,000 pts");
      });

      it("shows no upcoming tiers group when on the last tier", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          bookingPromotions: [
            {
              appliedValue: 100,
              isPreQualifying: false,
              isOrphaned: false,
              eligibleStayCount: 5, // stay #5 — last tier (4+)
              eligibleNightCount: 10,
              promotion: tieredPromo,
              benefitApplications: [
                {
                  appliedValue: 100,
                  promotionBenefit: {
                    rewardType: "points",
                    valueType: "fixed",
                    value: "10000",
                    certType: null,
                  },
                },
              ],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const upcomingGroup = promo.groups.find((g) => g.name === "Upcoming Tiers");

        expect(upcomingGroup).toBeUndefined();
      });
    });

    describe("tier-based pre-qualifying (no explicit prerequisite)", () => {
      it("shows current position and full tier table when stay doesn't match any tier", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          bookingPromotions: [
            {
              appliedValue: 0,
              isPreQualifying: true,
              eligibleStayCount: 1, // stay #1, tiers start at 2
              eligibleNightCount: 2,
              promotion: {
                name: "GHA Multi Brand",
                restrictions: null,
                benefits: [],
                tiers: [
                  {
                    minStays: 2,
                    maxStays: 2,
                    minNights: null,
                    maxNights: null,
                    benefits: [
                      { rewardType: "points", valueType: "fixed", value: "5000", certType: null },
                    ],
                  },
                  {
                    minStays: 3,
                    maxStays: null,
                    minNights: null,
                    maxNights: null,
                    benefits: [
                      { rewardType: "points", valueType: "fixed", value: "7500", certType: null },
                    ],
                  },
                ],
              },
              benefitApplications: [],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const tierGroup = promo.groups.find((g) => g.name === "Promotion Tiers");

        expect(tierGroup).toBeDefined();
        // First segment: current position (no $0 clutter, no "this booking counts" text)
        const positionSegment = tierGroup!.segments[0];
        expect(positionSegment.label).toBe("Your Current Position");
        expect(positionSegment.hideValue).toBe(true);
        expect(positionSegment.formula).toContain("Stay 1 of campaign");
        expect(positionSegment.formula).toContain("tier rewards begin at stay 2");
        expect(positionSegment.description).toContain("eligible stay #1");
        expect(positionSegment.description).not.toContain("This booking counts");
        // Subsequent segments: tier rewards (no $0 values, no redundant benefit group)
        const tier1 = tierGroup!.segments[1];
        expect(tier1.label).toContain("Stay 2");
        expect(tier1.hideValue).toBe(true);
        expect(tier1.formula).toContain("5,000 pts");
        const tier2 = tierGroup!.segments[2];
        expect(tier2.label).toContain("Stay 3+");
        expect(tier2.hideValue).toBe(true);
        expect(tier2.formula).toContain("7,500 pts");
        // Benefit group is suppressed — tier table already explains the rewards
        expect(promo.groups).toHaveLength(1);
      });

      it("does NOT show current position segment when a prerequisite is also present", () => {
        const booking: NetCostBooking = {
          ...preQualifyingBase,
          bookingPromotions: [
            {
              appliedValue: 0,
              isPreQualifying: true,
              eligibleStayCount: 1,
              eligibleNightCount: 2,
              promotion: {
                name: "Prereq + Tiers Promo",
                restrictions: { prerequisiteStayCount: 1 },
                benefits: [],
                tiers: [
                  {
                    minStays: 2,
                    maxStays: null,
                    minNights: null,
                    maxNights: null,
                    benefits: [
                      { rewardType: "points", valueType: "fixed", value: "5000", certType: null },
                    ],
                  },
                ],
              },
              benefitApplications: [],
            },
          ],
        };

        const breakdown = getNetCostBreakdown(booking);
        const promo = breakdown.promotions[0];
        const tierGroup = promo.groups.find((g) => g.name === "Promotion Tiers");

        expect(tierGroup).toBeDefined();
        // No "Your Current Position" segment — prereq group already explains the status
        const hasPositionSegment = tierGroup!.segments.some(
          (s) => s.label === "Your Current Position"
        );
        expect(hasPositionSegment).toBe(false);
        // Still shows the tier rewards (with hideValue, no redundant benefit group)
        expect(tierGroup!.segments[0].label).toContain("Stay 2+");
        expect(tierGroup!.segments[0].hideValue).toBe(true);
        // Only 2 groups: Prerequisite Stays + Promotion Tiers (benefit group suppressed)
        expect(promo.groups).toHaveLength(2);
      });
    });
  });
});
