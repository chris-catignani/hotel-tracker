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
    tieInCards: [],
    tieInRequiresPayment: false,
    startDate: null,
    endDate: null,
    minSpend: null,
    isActive: true,
    maxRedemptionCount: null,
    maxRedemptionValue: null,
    maxTotalBonusPoints: null,
    minNightsRequired: null,
    nightsStackable: false,
    bookByDate: null,
    oncePerSubBrand: false,
    exclusions: [],
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

  it("should calculate certificate and eqn with hardcoded applied value", () => {
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
    // Cert: 35000 pts * 0.015 $/pt * 0.7 = 367.5
    // EQN: 1 * 10.0 = 10
    // Total: 367.5 + 10 = 377.5
    expect(matched[0].appliedValue).toBe(377.5);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(367.5);
    expect(matched[0].benefitApplications[1].appliedValue).toBe(10);
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
  it("should respect maxRedemptionCount: 1 — skip when already used once", () => {
    const promo = makePromo({ maxRedemptionCount: 1 });
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

  // Exclusion tests
  it("should apply promotion when booking sub-brand is not in exclusion list", () => {
    // mockBooking has hotelChainSubBrandId: 4; exclude sub-brand 99
    const promo = makePromo({ exclusions: [{ hotelChainSubBrandId: 99 }] });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  it("should skip promotion when booking sub-brand is in exclusion list", () => {
    // mockBooking has hotelChainSubBrandId: 4; exclude sub-brand 4
    const promo = makePromo({ exclusions: [{ hotelChainSubBrandId: 4 }] });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(0);
  });

  it("should apply promotion when booking has no sub-brand and exclusions exist", () => {
    // Exclusion only blocks bookings at specific sub-brands; null sub-brand is not excluded
    const bookingNoSubBrand = { ...mockBooking, hotelChainSubBrandId: null };
    const promo = makePromo({ exclusions: [{ hotelChainSubBrandId: 4 }] });
    const matched = calculateMatchedPromotions(bookingNoSubBrand, [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  // Tie-in credit card tests
  const baseBenefit = {
    id: 20,
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(10),
    certType: null,
    pointsMultiplierBasis: null,
    isTieIn: false,
    sortOrder: 0,
  };
  const tieInBenefit = {
    id: 21,
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(15),
    certType: null,
    pointsMultiplierBasis: null,
    isTieIn: true,
    sortOrder: 1,
  };

  it("tie-in: card matches — all benefits (base + tie-in) apply", () => {
    // mockBooking has creditCardId: 1; tie-in requires card 1
    const promo = makePromo({
      tieInCards: [{ creditCardId: 1 }],
      benefits: [baseBenefit, tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
    // $10 base + $15 tie-in = $25
    expect(matched[0].appliedValue).toBe(25);
    expect(matched[0].benefitApplications).toHaveLength(2);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(10);
    expect(matched[0].benefitApplications[1].appliedValue).toBe(15);
  });

  it("tie-in: card absent — only base benefits apply; tie-in benefits are skipped", () => {
    // mockBooking has creditCardId: 1; tie-in requires card 99
    const promo = makePromo({
      tieInCards: [{ creditCardId: 99 }],
      benefits: [baseBenefit, tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
    // Only $10 base benefit applies
    expect(matched[0].appliedValue).toBe(10);
    expect(matched[0].benefitApplications).toHaveLength(1);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(10);
  });

  it("tie-in: only tie-in benefits, card absent — promotion yields 0 and is skipped", () => {
    // No base benefits; tie-in card doesn't match
    const promo = makePromo({
      tieInCards: [{ creditCardId: 99 }],
      benefits: [tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(0);
  });

  it("tie-in: only tie-in benefits, card present — promotion applies normally", () => {
    // No base benefits; tie-in card matches (card 1)
    const promo = makePromo({
      tieInCards: [{ creditCardId: 1 }],
      benefits: [tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(15);
    expect(matched[0].benefitApplications).toHaveLength(1);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(15);
  });

  it("tie-in: empty tieInCards — promotion matches regardless of booking card", () => {
    // No tie-in restriction; both benefits apply for any booking
    const loyaltyPromo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: 3,
      tieInCards: [],
      benefits: [baseBenefit, tieInBenefit],
    });
    const loyaltyMatched = calculateMatchedPromotions(mockBooking, [loyaltyPromo]);
    expect(loyaltyMatched).toHaveLength(1);
    // Both base and tie-in apply since tieInCreditCardId is null
    expect(loyaltyMatched[0].appliedValue).toBe(25);
    expect(loyaltyMatched[0].benefitApplications).toHaveLength(2);
  });

  it("tie-in: booking card matches any card in the list — all benefits apply", () => {
    // mockBooking has creditCardId: 1; list has cards 1 and 99
    const promo = makePromo({
      tieInCards: [{ creditCardId: 99 }, { creditCardId: 1 }],
      benefits: [baseBenefit, tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(25); // $10 + $15
    expect(matched[0].benefitApplications).toHaveLength(2);
  });

  it("tie-in: tieInRequiresPayment=true produces same match result as false (semantic only)", () => {
    // tieInRequiresPayment only affects display; matching is the same either way
    const promoHold = makePromo({
      tieInCards: [{ creditCardId: 1 }],
      tieInRequiresPayment: false,
      benefits: [baseBenefit, tieInBenefit],
    });
    const promoPay = makePromo({
      tieInCards: [{ creditCardId: 1 }],
      tieInRequiresPayment: true,
      benefits: [baseBenefit, tieInBenefit],
    });
    const matchedHold = calculateMatchedPromotions(mockBooking, [promoHold]);
    const matchedPay = calculateMatchedPromotions(mockBooking, [promoPay]);
    expect(matchedHold).toHaveLength(1);
    expect(matchedPay).toHaveLength(1);
    expect(matchedHold[0].appliedValue).toBe(matchedPay[0].appliedValue);
    expect(matchedHold[0].benefitApplications).toHaveLength(
      matchedPay[0].benefitApplications.length
    );
  });

  // Registration-based start dates tests
  describe("registration-based start dates", () => {
    it("should match if within personal validity window (registrationDate + validDaysAfterRegistration)", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-05-20"),
        validDaysAfterRegistration: 30, // valid until 2026-06-19
      });
      // mockBooking.checkIn is 2026-06-01 (within window)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(1);
    });

    it("should skip if before registration date", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-06-10"),
        validDaysAfterRegistration: 30,
      });
      // mockBooking.checkIn is 2026-06-01 (before registration)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(0);
    });

    it("should skip if after personal validity window", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-04-01"),
        validDaysAfterRegistration: 30, // valid until 2026-05-01
      });
      // mockBooking.checkIn is 2026-06-01 (after window)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(0);
    });

    it("should fallback to global endDate if validDaysAfterRegistration is missing", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-05-01"),
        validDaysAfterRegistration: null,
        endDate: new Date("2026-07-01"),
      });
      // mockBooking.checkIn is 2026-06-01 (within global window)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(1);
    });

    it("should fallback to global endDate if registrationDate is missing", () => {
      const promo = makePromo({
        registrationDate: null,
        validDaysAfterRegistration: 30,
        endDate: new Date("2026-07-01"),
      });
      // mockBooking.checkIn is 2026-06-01 (within global window)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(1);
    });

    it("should match if personal window extends beyond global endDate", () => {
      const promo = makePromo({
        endDate: new Date("2026-05-31"), // global period ends
        registrationDate: new Date("2026-05-20"),
        validDaysAfterRegistration: 30, // valid until 2026-06-19
      });
      // mockBooking.checkIn is 2026-06-01 (past global end, but within personal window)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(1);
    });

    it("should ignore global startDate once user is registered", () => {
      const promo = makePromo({
        startDate: new Date("2026-06-15"), // global period hasn't started
        registrationDate: new Date("2026-05-20"),
        validDaysAfterRegistration: 90,
      });
      // mockBooking.checkIn is 2026-06-01 (before global start, but after registration)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(1);
    });

    it("should skip if registration date is after registration deadline", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-06-01"),
        registrationDeadline: new Date("2026-05-15"),
        validDaysAfterRegistration: 30,
      });
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(0);
    });

    it("should respect global startDate if user is NOT registered", () => {
      const promo = makePromo({
        startDate: new Date("2026-06-15"),
        registrationDate: null,
      });
      // mockBooking.checkIn is 2026-06-01 (before global start)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(0);
    });

    it("should match stays on/after registration if no duration or global endDate is set", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-05-01"),
        validDaysAfterRegistration: null,
        endDate: null,
      });
      // mockBooking.checkIn is 2026-06-01 (after registration)
      const matched = calculateMatchedPromotions(mockBooking, [promo]);
      expect(matched).toHaveLength(1);
    });
  });
});
