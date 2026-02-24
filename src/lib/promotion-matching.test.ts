import { describe, it, expect } from "vitest";
import { calculateMatchedPromotions, MatchingBooking } from "./promotion-matching";
import { PromotionType, PromotionRewardType, PromotionBenefitValueType } from "@prisma/client";
import { Prisma } from "@prisma/client";

type TestPromotion = Parameters<typeof calculateMatchedPromotions>[1][number];

const mockBooking: MatchingBooking = {
  creditCardId: 1,
  shoppingPortalId: 2,
  hotelChainId: 3,
  hotelChainSubBrandId: 4,
  checkIn: new Date("2026-06-01"),
  createdAt: new Date("2026-01-01"),
  numNights: 3,
  pretaxCost: 80,
  totalCost: 100,
  loyaltyPointsEarned: 1000,
  hotelChain: {
    basePointRate: 10,
    pointType: { centsPerPoint: 0.015 }, // non-default
  },
  creditCard: {
    pointType: { centsPerPoint: 0.02 }, // distinct non-default
  },
};

function makePromo(overrides: Partial<TestPromotion> = {}): TestPromotion {
  return {
    id: 1,
    name: "Test Promo",
    type: PromotionType.credit_card,
    creditCardId: 1,
    shoppingPortalId: null,
    hotelChainId: null,
    hotelChainSubBrandId: null,
    startDate: null,
    endDate: null,
    minSpend: null,
    isActive: true,
    isSingleUse: false,
    maxRedemptionCount: null,
    maxRedemptionValue: null,
    maxTotalBonusPoints: null,
    minNightsRequired: null,
    nightsStackable: false,
    bookByDate: null,
    oncePerSubBrand: false,
    benefits: [
      {
        id: 10,
        rewardType: PromotionRewardType.cashback,
        valueType: PromotionBenefitValueType.fixed,
        value: new Prisma.Decimal(10),
        certType: null,
        pointsMultiplierBasis: null,
        sortOrder: 0,
      },
    ],
    tiers: [],
    ...overrides,
  };
}

describe("promotion-matching", () => {
  it("should match a valid credit card promotion with fixed cashback", () => {
    const matched = calculateMatchedPromotions(mockBooking, [makePromo()]);
    expect(matched).toHaveLength(1);
    expect(matched[0].promotionId).toBe(1);
    expect(matched[0].appliedValue).toBe(10);
    expect(matched[0].benefitApplications).toHaveLength(1);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(10);
  });

  it("should not match if credit card ID differs", () => {
    const matched = calculateMatchedPromotions(mockBooking, [makePromo({ creditCardId: 99 })]);
    expect(matched).toHaveLength(0);
  });

  it("should match loyalty promotion", () => {
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: 3,
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
  });

  it("should respect sub-brand filter", () => {
    const promoWithCorrectSubBrand = makePromo({ hotelChainSubBrandId: 4 });
    const promoWithWrongSubBrand = makePromo({ hotelChainSubBrandId: 99 });

    expect(calculateMatchedPromotions(mockBooking, [promoWithCorrectSubBrand])).toHaveLength(1);
    expect(calculateMatchedPromotions(mockBooking, [promoWithWrongSubBrand])).toHaveLength(0);
  });

  it("should respect date ranges", () => {
    const promoInRange = makePromo({
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-07-01"),
    });
    const promoPast = makePromo({
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
    });

    expect(calculateMatchedPromotions(mockBooking, [promoInRange])).toHaveLength(1);
    expect(calculateMatchedPromotions(mockBooking, [promoPast])).toHaveLength(0);
  });

  it("should respect min spend for credit card promos", () => {
    const promoLowMin = makePromo({ minSpend: new Prisma.Decimal(50) });
    const promoHighMin = makePromo({ minSpend: new Prisma.Decimal(200) });

    expect(calculateMatchedPromotions(mockBooking, [promoLowMin])).toHaveLength(1);
    expect(calculateMatchedPromotions(mockBooking, [promoHighMin])).toHaveLength(0);
  });

  it("should calculate cashback percentage value correctly", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.percentage,
          value: new Prisma.Decimal(15),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched[0].appliedValue).toBe(15); // 15% of 100
    expect(matched[0].benefitApplications[0].appliedValue).toBe(15);
  });

  it("should calculate points multiplier value correctly using hotel chain cents/point", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: "base_and_elite",
          sortOrder: 0,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    // 1000 pts * (3-1) * 0.015 $/pt = 30
    expect(matched[0].appliedValue).toBe(30);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(30);
  });

  it("should calculate fixed points value correctly", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(2000),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    // 2000 pts * 0.015 $/pt = 30
    expect(matched[0].appliedValue).toBe(30);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(30);
  });

  it("should calculate certificate and eqn as zero applied value", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.certificate,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(1),
          certType: "marriott_35k",
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
        {
          id: 11,
          rewardType: PromotionRewardType.eqn,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(1),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 1,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched[0].appliedValue).toBe(0);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(0);
    expect(matched[0].benefitApplications[1].appliedValue).toBe(0);
  });

  it("should sum multiple benefits correctly", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
        {
          id: 11,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(1000),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 1,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    // 10 (fixed cashback) + 1000 pts * 0.015 (= 15) = 25
    expect(matched[0].appliedValue).toBe(25);
    expect(matched[0].benefitApplications).toHaveLength(2);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(10);
    expect(matched[0].benefitApplications[1].appliedValue).toBe(15);
  });

  it("should calculate points multiplier with base_only basis", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: "base_only",
          sortOrder: 0,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    // basePoints = 80 (pretaxCost) * 10 (basePointRate) = 800
    // 800 pts * (3-1) * 0.015 $/pt = 24
    expect(matched[0].appliedValue).toBe(24);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(24);
  });

  it("should calculate points multiplier with base_and_elite basis", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: "base_and_elite",
          sortOrder: 0,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    // Uses full loyaltyPointsEarned = 1000
    // 1000 pts * (3-1) * 0.015 $/pt = 30
    expect(matched[0].appliedValue).toBe(30);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(30);
  });

  it("should default to base_only when pointsMultiplierBasis is null", () => {
    const promo = makePromo({
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    // basePoints = 80 * 10 = 800
    // 800 * (3-1) * 0.015 = 24
    expect(matched[0].appliedValue).toBe(24);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(24);
  });

  // Constraint tests
  it("should respect isSingleUse: allow when no prior usage", () => {
    const promo = makePromo({ isSingleUse: true });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
  });

  it("should respect isSingleUse: skip when already used", () => {
    const promo = makePromo({ isSingleUse: true });
    const priorUsage = new Map([[promo.id, { count: 1, totalValue: 10, totalBonusPoints: 0 }]]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(0);
  });

  it("should respect maxRedemptionCount: allow below limit", () => {
    const promo = makePromo({ maxRedemptionCount: 3 });
    const priorUsage = new Map([[promo.id, { count: 1, totalValue: 10, totalBonusPoints: 0 }]]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
  });

  it("should respect maxRedemptionCount: skip at limit", () => {
    const promo = makePromo({ maxRedemptionCount: 2 });
    const priorUsage = new Map([[promo.id, { count: 2, totalValue: 10, totalBonusPoints: 0 }]]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(0);
  });

  it("should respect minNightsRequired: skip below minimum", () => {
    const promo = makePromo({ minNightsRequired: 5 });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(0);
  });

  it("should respect minNightsRequired: allow at minimum", () => {
    const promo = makePromo({ minNightsRequired: 3 });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
  });

  it("should apply nightsStackable multiplier correctly", () => {
    const promo = makePromo({
      minNightsRequired: 2,
      nightsStackable: true,
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
      ],
    });
    const booking = { ...mockBooking, numNights: 6 }; // 6 nights / 2 = 3x multiplier
    const matched = calculateMatchedPromotions(booking, [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(30); // 10 * 3
  });

  it("should respect bookByDate: allow before cutoff", () => {
    const promo = makePromo({
      bookByDate: new Date("2026-02-01"),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
  });

  it("should respect bookByDate: skip after cutoff", () => {
    const promo = makePromo({
      bookByDate: new Date("2025-12-01"),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(0);
  });

  it("should respect maxRedemptionValue: cap appliedValue", () => {
    const promo = makePromo({
      maxRedemptionValue: new Prisma.Decimal(60),
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(50),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
      ],
    });
    const priorUsage = new Map([[promo.id, { count: 0, totalValue: 45, totalBonusPoints: 0 }]]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(15); // capped at 60 - 45 = 15
  });

  it("should skip if maxRedemptionValue cap exhausted", () => {
    const promo = makePromo({
      maxRedemptionValue: new Prisma.Decimal(50),
    });
    const priorUsage = new Map([[promo.id, { count: 0, totalValue: 50, totalBonusPoints: 0 }]]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(0);
  });

  it("should respect maxTotalBonusPoints: cap bonus points and reduce appliedValue", () => {
    const promo = makePromo({
      maxTotalBonusPoints: 100,
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(200),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
      ],
    });
    const priorUsage = new Map([[promo.id, { count: 0, totalValue: 0, totalBonusPoints: 50 }]]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
    // Original: 200 pts * 0.015 = 3, bonusPoints = 200
    // Remaining capacity: 100 - 50 = 50 points
    // Ratio: 50 / 200 = 0.25
    // Capped appliedValue: 3 * 0.25 = 0.75
    // Capped bonusPoints: 50
    expect(matched[0].bonusPointsApplied).toBe(50);
    expect(matched[0].appliedValue).toBeCloseTo(0.75, 2);
  });

  it("should skip if maxTotalBonusPoints cap exhausted", () => {
    const promo = makePromo({
      maxTotalBonusPoints: 50,
      benefits: [
        {
          id: 10,
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(100),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
        },
      ],
    });
    const priorUsage = new Map([[promo.id, { count: 0, totalValue: 0, totalBonusPoints: 50 }]]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(0);
  });

  // tier tests
  const tier1Benefit = {
    id: 101,
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(50),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
  };
  const tier2Benefit = {
    id: 102,
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(75),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
  };
  const tier3Benefit = {
    id: 103,
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(100),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
  };

  function makeTieredPromo() {
    return makePromo({
      benefits: [],
      tiers: [
        { id: 1, minStays: 1, maxStays: 1, benefits: [tier1Benefit] },
        { id: 2, minStays: 2, maxStays: 2, benefits: [tier2Benefit] },
        { id: 3, minStays: 3, maxStays: null, benefits: [tier3Benefit] },
      ],
    });
  }

  it("tiered: 0 prior matched stays → tier 1 benefits apply ($50)", () => {
    const promo = makeTieredPromo();
    // No prior usage → count=0 → currentStayNumber=1 → tier 1
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(50);
    expect(matched[0].benefitApplications[0].promotionBenefitId).toBe(101);
  });

  it("tiered: 1 prior eligible stay → tier 2 benefits apply ($75)", () => {
    const promo = makeTieredPromo();
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 0, totalBonusPoints: 0, eligibleStayCount: 1 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(75);
    expect(matched[0].benefitApplications[0].promotionBenefitId).toBe(102);
  });

  it("tiered: 2 prior eligible stays → tier 3 (maxStays=null) benefits apply ($100)", () => {
    const promo = makeTieredPromo();
    const priorUsage = new Map([
      [promo.id, { count: 1, totalValue: 50, totalBonusPoints: 0, eligibleStayCount: 2 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(100);
    expect(matched[0].benefitApplications[0].promotionBenefitId).toBe(103);
  });

  it("tiered: 5 prior eligible stays → still tier 3 (no upper bound)", () => {
    const promo = makeTieredPromo();
    const priorUsage = new Map([
      [promo.id, { count: 3, totalValue: 300, totalBonusPoints: 0, eligibleStayCount: 5 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(100);
  });

  it("tiered: no tier covers stay count → no match (stay #1 with minStays=2 tier)", () => {
    // Tiers only cover stay #2+, so stay #1 (eligibleStayCount=0) has no match
    const promo = makePromo({
      benefits: [],
      tiers: [{ id: 1, minStays: 2, maxStays: null, benefits: [tier2Benefit] }],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(0);
  });

  it("tiered: stay #1 has no tier, stay #2 correctly advances via eligibleStayCount", () => {
    // Tier only covers stay #2+; eligibleStayCount=1 means this is stay #2
    const promo = makePromo({
      benefits: [],
      tiers: [{ id: 1, minStays: 2, maxStays: null, benefits: [tier2Benefit] }],
    });
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 0, totalBonusPoints: 0, eligibleStayCount: 1 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(75);
  });

  it("tiered: maxStays boundary respected (stay at maxStays+1 → no match)", () => {
    const promo = makePromo({
      benefits: [],
      tiers: [{ id: 1, minStays: 1, maxStays: 2, benefits: [tier1Benefit] }],
    });
    const priorUsage = new Map([
      [promo.id, { count: 2, totalValue: 0, totalBonusPoints: 0, eligibleStayCount: 2 }],
    ]);
    // currentStayNumber=3, tier maxStays=2 → no match
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(0);
  });

  it("flat promo (no tiers) still works as before", () => {
    const promo = makePromo({ tiers: [] });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  // oncePerSubBrand tests
  it("should apply when oncePerSubBrand=true and appliedSubBrandIds is empty", () => {
    const promo = makePromo({ oncePerSubBrand: true });
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 0,
          totalValue: 0,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<number | null>(),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
  });

  it("should skip when oncePerSubBrand=true and booking sub-brand already in appliedSubBrandIds", () => {
    const promo = makePromo({ oncePerSubBrand: true });
    // mockBooking has hotelChainSubBrandId: 4
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<number | null>([4]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(0);
  });

  it("should apply when oncePerSubBrand=true and booking sub-brand is different from already-applied ones", () => {
    const promo = makePromo({ oncePerSubBrand: true });
    // mockBooking has hotelChainSubBrandId: 4, appliedSubBrandIds has 5
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<number | null>([5]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
  });

  it("should always apply when oncePerSubBrand=false", () => {
    const promo = makePromo({ oncePerSubBrand: false });
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<number | null>([4]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage);
    expect(matched).toHaveLength(1);
  });

  it("should skip when oncePerSubBrand=true, booking has null sub-brand, and null is in appliedSubBrandIds", () => {
    const promo = makePromo({ oncePerSubBrand: true });
    const bookingNoSubBrand = { ...mockBooking, hotelChainSubBrandId: null };
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<number | null>([null]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(bookingNoSubBrand, [promo], priorUsage);
    expect(matched).toHaveLength(0);
  });
});
