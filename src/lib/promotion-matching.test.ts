import { describe, it, expect } from "vitest";
import {
  calculateMatchedPromotions,
  MatchingBooking,
  getConstrainedPromotions,
} from "./promotion-matching";
import {
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  CertType,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { BenefitValuationData } from "./benefit-valuations";

type TestPromotion = Parameters<typeof calculateMatchedPromotions>[1][number];
type TestRestrictions = NonNullable<TestPromotion["restrictions"]>;

const mockBooking: MatchingBooking = {
  creditCardId: "card-1",
  shoppingPortalId: "portal-2",
  hotelChainId: "chain-3",
  hotelChainSubBrandId: "brand-4",
  checkIn: new Date("2026-06-01"),
  createdAt: new Date("2026-01-01"),
  numNights: 3,
  pretaxCost: 80,
  totalCost: 100,
  loyaltyPointsEarned: 1000,
  pointsRedeemed: null,
  hotelChain: {
    basePointRate: 10,
    pointType: { centsPerPoint: 0.015 }, // non-default
  },
  creditCard: {
    pointType: { centsPerPoint: 0.02 }, // distinct non-default
  },
};

const mockValuations: BenefitValuationData[] = [
  {
    id: "v1",
    hotelChainId: null,
    isEqn: true,
    certType: null,
    benefitType: null,
    value: 10,
    valueType: "dollar",
  },
  {
    id: "v2",
    hotelChainId: null,
    isEqn: false,
    certType: "marriott_35k" as CertType,
    benefitType: null,
    value: 35000,
    valueType: "points",
  },
];

function makeRestrictions(overrides: Partial<TestRestrictions> = {}): TestRestrictions {
  return {
    minSpend: null,
    minNightsRequired: null,
    nightsStackable: false,
    spanStays: false,
    maxStayCount: null,
    maxRewardCount: null,
    maxRedemptionValue: null,
    maxTotalBonusPoints: null,
    oncePerSubBrand: false,
    bookByDate: null,
    registrationDeadline: null,
    validDaysAfterRegistration: null,
    tieInRequiresPayment: false,
    allowedPaymentTypes: [],
    subBrandRestrictions: [],
    tieInCards: [],
    ...overrides,
  };
}

function makePromo(overrides: Partial<TestPromotion> = {}): TestPromotion {
  return {
    id: "promo-1",
    type: PromotionType.credit_card,
    creditCardId: "card-1",
    shoppingPortalId: null,
    hotelChainId: null,
    startDate: null,
    endDate: null,
    isActive: true,
    restrictions: null,
    registrationDate: null,
    benefits: [
      {
        id: "benefit-10",
        rewardType: PromotionRewardType.cashback,
        valueType: PromotionBenefitValueType.fixed,
        value: new Prisma.Decimal(10),
        certType: null,
        pointsMultiplierBasis: null,
        sortOrder: 0,
        restrictions: null,
      },
    ],
    tiers: [],
    ...overrides,
  };
}

describe("promotion-matching", () => {
  it("should match a valid credit card promotion with fixed cashback", () => {
    const matched = calculateMatchedPromotions(
      mockBooking,
      [makePromo()],
      new Map(),
      mockValuations
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].promotionId).toBe("promo-1");
    expect(matched[0].appliedValue).toBe(10);
    expect(matched[0].benefitApplications).toHaveLength(1);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(10);
  });

  it("should not match if credit card ID differs", () => {
    const matched = calculateMatchedPromotions(
      mockBooking,
      [makePromo({ creditCardId: "card-99" })],
      new Map(),
      mockValuations
    );
    expect(matched).toHaveLength(0);
  });

  it("should match loyalty promotion", () => {
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
  });

  it("should respect sub-brand include restriction", () => {
    const promoWithCorrectSubBrand = makePromo({
      restrictions: makeRestrictions({
        subBrandRestrictions: [{ hotelChainSubBrandId: "brand-4", mode: "include" }],
      }),
    });
    const promoWithWrongSubBrand = makePromo({
      restrictions: makeRestrictions({
        subBrandRestrictions: [{ hotelChainSubBrandId: "brand-99", mode: "include" }],
      }),
    });

    expect(
      calculateMatchedPromotions(mockBooking, [promoWithCorrectSubBrand], new Map(), mockValuations)
    ).toHaveLength(1);
    expect(
      calculateMatchedPromotions(mockBooking, [promoWithWrongSubBrand], new Map(), mockValuations)
    ).toHaveLength(0);
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

    expect(
      calculateMatchedPromotions(mockBooking, [promoInRange], new Map(), mockValuations)
    ).toHaveLength(1);
    expect(
      calculateMatchedPromotions(mockBooking, [promoPast], new Map(), mockValuations)
    ).toHaveLength(0);
  });

  it("should respect min spend for credit card promos", () => {
    const promoLowMin = makePromo({
      restrictions: makeRestrictions({ minSpend: new Prisma.Decimal(50) }),
    });
    const promoHighMin = makePromo({
      restrictions: makeRestrictions({ minSpend: new Prisma.Decimal(200) }),
    });

    expect(
      calculateMatchedPromotions(mockBooking, [promoLowMin], new Map(), mockValuations)
    ).toHaveLength(1);
    expect(
      calculateMatchedPromotions(mockBooking, [promoHighMin], new Map(), mockValuations)
    ).toHaveLength(0);
  });

  it("should calculate cashback percentage value correctly", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.percentage,
          value: new Prisma.Decimal(15),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched[0].appliedValue).toBe(15); // 15% of 100
    expect(matched[0].benefitApplications[0].appliedValue).toBe(15);
  });

  it("should calculate points multiplier value correctly using hotel chain cents/point", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: "base_and_elite",
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    // 1000 pts * (3-1) * 0.015 $/pt = 30
    expect(matched[0].appliedValue).toBe(30);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(30);
  });

  it("should calculate fixed points value correctly", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(2000),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    // 2000 pts * 0.015 $/pt = 30
    expect(matched[0].appliedValue).toBe(30);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(30);
  });

  it("should calculate certificate and eqn with hardcoded applied value", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.certificate,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(1),
          certType: "marriott_35k",
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
        {
          id: "benefit-11",
          rewardType: PromotionRewardType.eqn,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(1),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 1,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    // Cert: 35000 pts * 0.015 $/pt = 525
    // EQN: 1 * 10.0 = 10
    // Total: 525 + 10 = 535
    expect(matched[0].appliedValue).toBe(535);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(525);
    expect(matched[0].benefitApplications[1].appliedValue).toBe(10);
  });

  it("should sum multiple benefits correctly", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
        {
          id: "benefit-11",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(1000),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 1,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
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
          id: "benefit-10",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: "base_only",
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    // basePoints = 80 (pretaxCost) * 10 (basePointRate) = 800
    // 800 pts * (3-1) * 0.015 $/pt = 24
    expect(matched[0].appliedValue).toBe(24);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(24);
  });

  it("should calculate points multiplier with base_and_elite basis", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: "base_and_elite",
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    // Uses full loyaltyPointsEarned = 1000
    // 1000 pts * (3-1) * 0.015 $/pt = 30
    expect(matched[0].appliedValue).toBe(30);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(30);
  });

  it("should default to base_only when pointsMultiplierBasis is null", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(3),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    // basePoints = 80 * 10 = 800
    // 800 * (3-1) * 0.015 = 24
    expect(matched[0].appliedValue).toBe(24);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(24);
  });

  // Constraint tests
  it("should respect maxStayCount: 1 — skip when already used once", () => {
    const promo = makePromo({ restrictions: makeRestrictions({ maxStayCount: 1 }) });
    const priorUsage = new Map([
      [promo.id, { count: 1, totalValue: 10, totalBonusPoints: 0, benefitUsage: new Map() }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should respect maxStayCount: allow below limit", () => {
    const promo = makePromo({ restrictions: makeRestrictions({ maxStayCount: 3 }) });
    const priorUsage = new Map([
      [promo.id, { count: 1, totalValue: 10, totalBonusPoints: 0, benefitUsage: new Map() }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
  });

  it("should respect maxStayCount: skip at limit", () => {
    const promo = makePromo({ restrictions: makeRestrictions({ maxStayCount: 2 }) });
    const priorUsage = new Map([
      [promo.id, { count: 2, totalValue: 10, totalBonusPoints: 0, benefitUsage: new Map() }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should respect minNightsRequired: skip below minimum", () => {
    const promo = makePromo({ restrictions: makeRestrictions({ minNightsRequired: 5 }) });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should respect minNightsRequired: allow at minimum", () => {
    const promo = makePromo({ restrictions: makeRestrictions({ minNightsRequired: 3 }) });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
  });

  it("should apply nightsStackable multiplier correctly", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ minNightsRequired: 2, nightsStackable: true }),
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const booking = { ...mockBooking, numNights: 6 }; // 6 nights / 2 = 3x multiplier
    const matched = calculateMatchedPromotions(booking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(30); // 10 * 3
    expect(matched[0].benefitApplications[0].appliedValue).toBe(30); // 10 * 3
  });

  it("should respect benefit-level maxRewardCount", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-count-limit",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ maxRewardCount: 2 }),
        },
      ],
    });
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 2,
          totalValue: 20,
          totalBonusPoints: 0,
          benefitUsage: new Map([
            ["benefit-count-limit", { count: 2, totalValue: 20, totalBonusPoints: 0 }],
          ]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(0); // benefit filtered out, promo has no benefits left
  });

  it("should respect benefit-level maxRedemptionValue", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-value-limit",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(50),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ maxRedemptionValue: new Prisma.Decimal(60) }),
        },
      ],
    });
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 45,
          totalBonusPoints: 0,
          benefitUsage: new Map([
            ["benefit-value-limit", { count: 1, totalValue: 45, totalBonusPoints: 0 }],
          ]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(15); // capped at 60 - 45 = 15
  });

  it("should respect benefit-level minSpend", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-min-spend",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ minSpend: new Prisma.Decimal(200) }),
        },
      ],
    });
    // mockBooking totalCost is 100, benefit requires 200
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should respect benefit-level oncePerSubBrand", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-once-subbrand",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ oncePerSubBrand: true }),
        },
      ],
    });
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          benefitUsage: new Map([
            ["benefit-once-subbrand", { count: 1, totalValue: 10, totalBonusPoints: 0 }],
          ]),
          appliedSubBrandIds: new Set(["brand-4"]), // mockBooking sub-brand is brand-4
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should respect benefit-level minNightsRequired", () => {
    const promo = makePromo({
      restrictions: null,
      benefits: [
        {
          id: "benefit-min-nights",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ minNightsRequired: 5 }),
        },
      ],
    });
    // Booking has 3 nights (from mockBooking), benefit requires 5
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should apply benefit-level nightsStackable multiplier", () => {
    const promo = makePromo({
      restrictions: null,
      benefits: [
        {
          id: "benefit-stackable",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ minNightsRequired: 2, nightsStackable: true }),
        },
      ],
    });
    const booking = { ...mockBooking, numNights: 6 }; // 6 nights / 2 = 3x multiplier
    const matched = calculateMatchedPromotions(booking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(30); // 10 * 3
  });

  it("should respect bookByDate: allow before cutoff", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ bookByDate: new Date("2026-02-01") }),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
  });

  it("should respect bookByDate: skip after cutoff", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ bookByDate: new Date("2025-12-01") }),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should respect maxRedemptionValue: cap appliedValue", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ maxRedemptionValue: new Prisma.Decimal(60) }),
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(50),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 45, totalBonusPoints: 0, benefitUsage: new Map() }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(15); // capped at 60 - 45 = 15
  });

  it("should return with 0 value if maxRedemptionValue cap exhausted", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ maxRedemptionValue: new Prisma.Decimal(50) }),
    });
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 50, totalBonusPoints: 0, benefitUsage: new Map() }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(0);
  });

  it("should respect maxTotalBonusPoints: cap bonus points and reduce appliedValue", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ maxTotalBonusPoints: 100 }),
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(200),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 0, totalBonusPoints: 50, benefitUsage: new Map() }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    // Original: 200 pts * 0.015 = 3, bonusPoints = 200
    // Remaining capacity: 100 - 50 = 50 points
    // Ratio: 50 / 200 = 0.25
    // Capped appliedValue: 3 * 0.25 = 0.75
    // Capped bonusPoints: 50
    expect(matched[0].bonusPointsApplied).toBe(50);
    expect(matched[0].appliedValue).toBeCloseTo(0.75, 2);
  });

  it("should return with 0 value if maxTotalBonusPoints cap exhausted", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ maxTotalBonusPoints: 50 }),
      benefits: [
        {
          id: "benefit-10",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(100),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 0, totalBonusPoints: 50, benefitUsage: new Map() }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].bonusPointsApplied).toBe(0);
    expect(matched[0].appliedValue).toBe(0);
  });

  // tier tests
  const tier1Benefit = {
    id: "benefit-101",
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(50),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
    restrictions: null,
  };
  const tier2Benefit = {
    id: "benefit-102",
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(75),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
    restrictions: null,
  };
  const tier3Benefit = {
    id: "benefit-103",
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(100),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
    restrictions: null,
  };

  function makeTieredPromo() {
    return makePromo({
      benefits: [],
      tiers: [
        { id: "tier-1", minStays: 1, maxStays: 1, benefits: [tier1Benefit] },
        { id: "tier-2", minStays: 2, maxStays: 2, benefits: [tier2Benefit] },
        { id: "tier-3", minStays: 3, maxStays: null, benefits: [tier3Benefit] },
      ],
    });
  }

  it("tiered: 0 prior matched stays → tier 1 benefits apply ($50)", () => {
    const promo = makeTieredPromo();
    // No prior usage → count=0 → currentStayNumber=1 → tier 1
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(50);
    expect(matched[0].benefitApplications[0].promotionBenefitId).toBe("benefit-101");
  });

  it("tiered: 1 prior eligible stay → tier 2 benefits apply ($75)", () => {
    const promo = makeTieredPromo();
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 0, totalBonusPoints: 0, eligibleStayCount: 1 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(75);
    expect(matched[0].benefitApplications[0].promotionBenefitId).toBe("benefit-102");
  });

  it("tiered: 2 prior eligible stays → tier 3 (maxStays=null) benefits apply ($100)", () => {
    const promo = makeTieredPromo();
    const priorUsage = new Map([
      [promo.id, { count: 1, totalValue: 50, totalBonusPoints: 0, eligibleStayCount: 2 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(100);
    expect(matched[0].benefitApplications[0].promotionBenefitId).toBe("benefit-103");
  });

  it("tiered: 5 prior eligible stays → still tier 3 (no upper bound)", () => {
    const promo = makeTieredPromo();
    const priorUsage = new Map([
      [promo.id, { count: 3, totalValue: 300, totalBonusPoints: 0, eligibleStayCount: 5 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(100);
  });

  it("tiered: no tier covers stay count → no match (stay #1 with minStays=2 tier)", () => {
    // Tiers only cover stay #2+, so stay #1 (eligibleStayCount=0) has no match
    const promo = makePromo({
      benefits: [],
      tiers: [{ id: "tier-1", minStays: 2, maxStays: null, benefits: [tier2Benefit] }],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("tiered: stay #1 has no tier, stay #2 correctly advances via eligibleStayCount", () => {
    // Tier only covers stay #2+; eligibleStayCount=1 means this is stay #2
    const promo = makePromo({
      benefits: [],
      tiers: [{ id: "tier-1", minStays: 2, maxStays: null, benefits: [tier2Benefit] }],
    });
    const priorUsage = new Map([
      [promo.id, { count: 0, totalValue: 0, totalBonusPoints: 0, eligibleStayCount: 1 }],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(75);
  });

  it("tiered: maxStays boundary respected (stay at maxStays+1 → no match)", () => {
    const promo = makePromo({
      benefits: [],
      tiers: [{ id: "tier-1", minStays: 1, maxStays: 2, benefits: [tier1Benefit] }],
    });
    const priorUsage = new Map([
      [promo.id, { count: 2, totalValue: 0, totalBonusPoints: 0, eligibleStayCount: 2 }],
    ]);
    // currentStayNumber=3, tier maxStays=2 → no match
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("flat promo (no tiers) still works as before", () => {
    const promo = makePromo({ tiers: [] });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  // oncePerSubBrand tests
  it("should apply when oncePerSubBrand=true and appliedSubBrandIds is empty", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ oncePerSubBrand: true }),
    });
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 0,
          totalValue: 0,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<string | null>(),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
  });

  it("should skip when oncePerSubBrand=true and booking sub-brand already in appliedSubBrandIds", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ oncePerSubBrand: true }),
    });
    // mockBooking has hotelChainSubBrandId: "brand-4"
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<string | null>(["brand-4"]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should apply when oncePerSubBrand=true and booking sub-brand is different from already-applied ones", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ oncePerSubBrand: true }),
    });
    // mockBooking has hotelChainSubBrandId: "brand-4", appliedSubBrandIds has "brand-5"
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<string | null>(["brand-5"]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
  });

  it("should always apply when oncePerSubBrand=false", () => {
    const promo = makePromo();
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<string | null>(["brand-4"]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
  });

  it("should skip when oncePerSubBrand=true, booking has null sub-brand, and null is in appliedSubBrandIds", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ oncePerSubBrand: true }),
    });
    const bookingNoSubBrand = { ...mockBooking, hotelChainSubBrandId: null };
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 10,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<string | null>([null]),
        },
      ],
    ]);
    const matched = calculateMatchedPromotions(
      bookingNoSubBrand,
      [promo],
      priorUsage,
      mockValuations
    );
    expect(matched).toHaveLength(0);
  });

  // Sub-brand scope tests (replaces old exclusion tests)
  it("should apply promotion when booking sub-brand is not in exclude list", () => {
    // mockBooking has hotelChainSubBrandId: "brand-4"; exclude "brand-99"
    const promo = makePromo({
      restrictions: makeRestrictions({
        subBrandRestrictions: [{ hotelChainSubBrandId: "brand-99", mode: "exclude" }],
      }),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  it("should skip promotion when booking sub-brand is in exclude list", () => {
    // mockBooking has hotelChainSubBrandId: "brand-4"; exclude "brand-4"
    const promo = makePromo({
      restrictions: makeRestrictions({
        subBrandRestrictions: [{ hotelChainSubBrandId: "brand-4", mode: "exclude" }],
      }),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("should apply promotion when booking has no sub-brand and exclude restrictions exist", () => {
    // Exclusion only blocks bookings at specific sub-brands; null sub-brand is not excluded
    const bookingNoSubBrand = { ...mockBooking, hotelChainSubBrandId: null };
    const promo = makePromo({
      restrictions: makeRestrictions({
        subBrandRestrictions: [{ hotelChainSubBrandId: "brand-4", mode: "exclude" }],
      }),
    });
    const matched = calculateMatchedPromotions(
      bookingNoSubBrand,
      [promo],
      new Map(),
      mockValuations
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  // Benefit-level restriction tests
  const baseBenefitDef = {
    id: "benefit-20",
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(10),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
    restrictions: null, // always applies
  };

  it("benefit-level tie-in: card matches — tie-in benefit applies alongside base", () => {
    // mockBooking has creditCardId: "card-1"; tie-in benefit requires "card-1"
    const tieInBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(15),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: makeRestrictions({ tieInCards: [{ creditCardId: "card-1" }] }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    // $10 base + $15 tie-in = $25
    expect(matched[0].appliedValue).toBe(25);
    expect(matched[0].benefitApplications).toHaveLength(2);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(10);
    expect(matched[0].benefitApplications[1].appliedValue).toBe(15);
  });

  it("benefit-level tie-in: card absent — tie-in benefit filtered, only base applies", () => {
    // mockBooking has creditCardId: "card-1"; tie-in requires "card-99"
    const tieInBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(15),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: makeRestrictions({ tieInCards: [{ creditCardId: "card-99" }] }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    // Only $10 base benefit applies
    expect(matched[0].appliedValue).toBe(10);
    expect(matched[0].benefitApplications).toHaveLength(1);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(10);
  });

  it("benefit-level tie-in: only tie-in benefit, card absent — promo yields 0 and is skipped", () => {
    const tieInBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(15),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 0,
      restrictions: makeRestrictions({ tieInCards: [{ creditCardId: "card-99" }] }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  it("benefit-level tie-in: only tie-in benefit, card present — promotion applies normally", () => {
    const tieInBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(15),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 0,
      restrictions: makeRestrictions({ tieInCards: [{ creditCardId: "card-1" }] }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(15);
    expect(matched[0].benefitApplications).toHaveLength(1);
    expect(matched[0].benefitApplications[0].appliedValue).toBe(15);
  });

  it("benefit-level tie-in: no restrictions — both benefits apply for any booking", () => {
    const extraBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(15),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: null,
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, extraBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(25);
    expect(matched[0].benefitApplications).toHaveLength(2);
  });

  it("benefit-level tie-in: card matches any card in the list — benefit applies", () => {
    // mockBooking has creditCardId: "card-1"; list has "card-99" and "card-1"
    const tieInBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(15),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: makeRestrictions({
        tieInCards: [{ creditCardId: "card-99" }, { creditCardId: "card-1" }],
      }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, tieInBenefit],
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(25); // $10 + $15
    expect(matched[0].benefitApplications).toHaveLength(2);
  });

  it("benefit-level tie-in: tieInRequiresPayment=true produces same match result (semantic only)", () => {
    const makeTieInBenefit = (tieInRequiresPayment: boolean) => ({
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(15),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: makeRestrictions({
        tieInCards: [{ creditCardId: "card-1" }],
        tieInRequiresPayment,
      }),
    });
    const promoHold = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, makeTieInBenefit(false)],
    });
    const promoPay = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, makeTieInBenefit(true)],
    });
    const matchedHold = calculateMatchedPromotions(
      mockBooking,
      [promoHold],
      new Map(),
      mockValuations
    );
    const matchedPay = calculateMatchedPromotions(
      mockBooking,
      [promoPay],
      new Map(),
      mockValuations
    );
    expect(matchedHold).toHaveLength(1);
    expect(matchedPay).toHaveLength(1);
    expect(matchedHold[0].appliedValue).toBe(matchedPay[0].appliedValue);
    expect(matchedHold[0].benefitApplications).toHaveLength(
      matchedPay[0].benefitApplications.length
    );
  });

  // Promotion-level tie-in gate tests
  it("promo-level tie-in gate: card matches — whole promo applies", () => {
    // mockBooking has creditCardId: "card-1"
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      restrictions: makeRestrictions({ tieInCards: [{ creditCardId: "card-1" }] }),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  it("promo-level tie-in gate: card absent — whole promo skipped", () => {
    // mockBooking has creditCardId: "card-1"; gate requires "card-99"
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      restrictions: makeRestrictions({ tieInCards: [{ creditCardId: "card-99" }] }),
    });
    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(0);
  });

  // Benefit-level sub-brand scope tests
  it("benefit with sub-brand include restriction: applies only to matching sub-brand", () => {
    const scopedBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(20),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: makeRestrictions({
        subBrandRestrictions: [{ hotelChainSubBrandId: "brand-4", mode: "include" }],
      }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, scopedBenefit],
    });

    // Booking at "brand-4" → both benefits apply
    const matchedAtBrand4 = calculateMatchedPromotions(
      mockBooking,
      [promo],
      new Map(),
      mockValuations
    );
    expect(matchedAtBrand4[0].appliedValue).toBe(30); // 10 + 20

    // Booking at different brand → only base applies
    const bookingAtOtherBrand = { ...mockBooking, hotelChainSubBrandId: "brand-99" };
    const matchedAtOther = calculateMatchedPromotions(
      bookingAtOtherBrand,
      [promo],
      new Map(),
      mockValuations
    );
    expect(matchedAtOther[0].appliedValue).toBe(10); // only base
  });

  it("benefit with sub-brand exclude restriction: skips excluded sub-brand benefit", () => {
    const scopedBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(20),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: makeRestrictions({
        subBrandRestrictions: [{ hotelChainSubBrandId: "brand-4", mode: "exclude" }],
      }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, scopedBenefit],
    });

    // Booking at "brand-4" → scoped benefit excluded, only base
    const matchedAtBrand4 = calculateMatchedPromotions(
      mockBooking,
      [promo],
      new Map(),
      mockValuations
    );
    expect(matchedAtBrand4[0].appliedValue).toBe(10); // only base

    // Booking at different brand → both apply
    const bookingAtOtherBrand = { ...mockBooking, hotelChainSubBrandId: "brand-99" };
    const matchedAtOther = calculateMatchedPromotions(
      bookingAtOtherBrand,
      [promo],
      new Map(),
      mockValuations
    );
    expect(matchedAtOther[0].appliedValue).toBe(30); // 10 + 20
  });

  it("benefit with oncePerSubBrand=true: skipped if same sub-brand already applied", () => {
    const onceBenefit = {
      id: "benefit-21",
      rewardType: PromotionRewardType.cashback,
      valueType: PromotionBenefitValueType.fixed,
      value: new Prisma.Decimal(20),
      certType: null,
      pointsMultiplierBasis: null,
      sortOrder: 1,
      restrictions: makeRestrictions({ oncePerSubBrand: true }),
    };
    const promo = makePromo({
      type: PromotionType.loyalty,
      creditCardId: null,
      hotelChainId: "chain-3",
      benefits: [baseBenefitDef, onceBenefit],
    });

    // First stay at "brand-4" → both apply
    const firstStay = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(firstStay[0].appliedValue).toBe(30);

    // Second stay at "brand-4" → onceBenefit filtered, only base applies
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 30,
          totalBonusPoints: 0,
          appliedSubBrandIds: new Set<string | null>(["brand-4"]),
        },
      ],
    ]);
    const secondStay = calculateMatchedPromotions(mockBooking, [promo], priorUsage, mockValuations);
    expect(secondStay[0].appliedValue).toBe(10); // only base
  });

  // Registration-based start dates tests
  describe("registration-based start dates", () => {
    it("should match if within personal validity window (registrationDate + validDaysAfterRegistration)", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-05-20"),
        restrictions: makeRestrictions({ validDaysAfterRegistration: 30 }), // valid until 2026-06-19
      });
      // mockBooking.checkIn is 2026-06-01 (within window)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(1);
    });

    it("should skip if before registration date", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-06-10"),
        restrictions: makeRestrictions({ validDaysAfterRegistration: 30 }),
      });
      // mockBooking.checkIn is 2026-06-01 (before registration)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(0);
    });

    it("should skip if after personal validity window", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-04-01"),
        restrictions: makeRestrictions({ validDaysAfterRegistration: 30 }), // valid until 2026-05-01
      });
      // mockBooking.checkIn is 2026-06-01 (after window)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(0);
    });

    it("should fallback to global endDate if validDaysAfterRegistration is missing", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-05-01"),
        endDate: new Date("2026-07-01"),
        restrictions: makeRestrictions({ validDaysAfterRegistration: null }),
      });
      // mockBooking.checkIn is 2026-06-01 (within global window)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(1);
    });

    it("should fallback to global endDate if registrationDate is missing", () => {
      const promo = makePromo({
        registrationDate: null,
        endDate: new Date("2026-07-01"),
        restrictions: makeRestrictions({ validDaysAfterRegistration: 30 }),
      });
      // mockBooking.checkIn is 2026-06-01 (within global window)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(1);
    });

    it("should match if personal window extends beyond global endDate", () => {
      const promo = makePromo({
        endDate: new Date("2026-05-31"), // global period ends
        registrationDate: new Date("2026-05-20"),
        restrictions: makeRestrictions({ validDaysAfterRegistration: 30 }), // valid until 2026-06-19
      });
      // mockBooking.checkIn is 2026-06-01 (past global end, but within personal window)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(1);
    });

    it("should ignore global startDate once user is registered", () => {
      const promo = makePromo({
        startDate: new Date("2026-06-15"), // global period hasn't started
        registrationDate: new Date("2026-05-20"),
        restrictions: makeRestrictions({ validDaysAfterRegistration: 90 }),
      });
      // mockBooking.checkIn is 2026-06-01 (before global start, but after registration)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(1);
    });

    it("should skip if registration date is after registration deadline", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-06-01"),
        restrictions: makeRestrictions({
          registrationDeadline: new Date("2026-05-15"),
          validDaysAfterRegistration: 30,
        }),
      });
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(0);
    });

    it("should respect global startDate if user is NOT registered", () => {
      const promo = makePromo({
        startDate: new Date("2026-06-15"),
        registrationDate: null,
      });
      // mockBooking.checkIn is 2026-06-01 (before global start)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(0);
    });

    it("should match stays on/after registration if no duration or global endDate is set", () => {
      const promo = makePromo({
        registrationDate: new Date("2026-05-01"),
        endDate: null,
        restrictions: makeRestrictions({ validDaysAfterRegistration: null }),
      });
      // mockBooking.checkIn is 2026-06-01 (after registration)
      const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
      expect(matched).toHaveLength(1);
    });
  });

  // Payment type restriction tests
  describe("payment type restrictions", () => {
    const cashBooking = {
      ...mockBooking,
      pretaxCost: 100,
      pointsRedeemed: 0,
      _count: { certificates: 0 },
    };
    const pointsBooking = {
      ...mockBooking,
      pretaxCost: 0,
      pointsRedeemed: 10000,
      _count: { certificates: 0 },
    };
    const certBooking = {
      ...mockBooking,
      pretaxCost: 0,
      pointsRedeemed: 0,
      _count: { certificates: 1 },
    };
    const mixedBooking = {
      ...mockBooking,
      pretaxCost: 50,
      pointsRedeemed: 5000,
      _count: { certificates: 0 },
    };

    it("empty allowedPaymentTypes: applies to everything", () => {
      const promo = makePromo({
        restrictions: makeRestrictions({ allowedPaymentTypes: [] }),
      });
      expect(
        calculateMatchedPromotions(cashBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
      expect(
        calculateMatchedPromotions(pointsBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
      expect(
        calculateMatchedPromotions(certBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
      expect(
        calculateMatchedPromotions(mixedBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
    });

    it("allowedPaymentTypes=['cash']: applies only to cash, skips points/certs", () => {
      const promo = makePromo({
        restrictions: makeRestrictions({ allowedPaymentTypes: ["cash"] }),
      });
      expect(
        calculateMatchedPromotions(cashBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
      expect(
        calculateMatchedPromotions(pointsBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
      expect(
        calculateMatchedPromotions(certBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
    });

    it("allowedPaymentTypes=['points']: applies only to points, skips cash/certs", () => {
      const promo = makePromo({
        restrictions: makeRestrictions({ allowedPaymentTypes: ["points"] }),
      });
      expect(
        calculateMatchedPromotions(pointsBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
      expect(
        calculateMatchedPromotions(cashBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
      expect(
        calculateMatchedPromotions(certBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
    });

    it("allowedPaymentTypes=['cert']: applies only to certs, skips cash/points", () => {
      const promo = makePromo({
        restrictions: makeRestrictions({ allowedPaymentTypes: ["cert"] }),
      });
      expect(
        calculateMatchedPromotions(certBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
      expect(
        calculateMatchedPromotions(cashBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
      expect(
        calculateMatchedPromotions(pointsBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
    });

    it("allowedPaymentTypes=['cash', 'points']: applies to mixed cash+points booking", () => {
      const promo = makePromo({
        restrictions: makeRestrictions({ allowedPaymentTypes: ["cash", "points"] }),
      });
      expect(
        calculateMatchedPromotions(mixedBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(1);
    });

    it("allowedPaymentTypes=['cash']: skips mixed cash+points booking because points are present but not allowed", () => {
      const promo = makePromo({
        restrictions: makeRestrictions({ allowedPaymentTypes: ["cash"] }),
      });
      expect(
        calculateMatchedPromotions(mixedBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
    });

    it("benefit-level payment restriction: only applicable benefits apply", () => {
      const cashBenefit = {
        ...baseBenefitDef,
        id: "b-cash",
        restrictions: makeRestrictions({ allowedPaymentTypes: ["cash"] }),
      };
      const pointsBenefit = {
        ...baseBenefitDef,
        id: "b-points",
        restrictions: makeRestrictions({ allowedPaymentTypes: ["points"] }),
      };
      const promo = makePromo({
        type: PromotionType.loyalty,
        creditCardId: null,
        hotelChainId: "chain-3",
        benefits: [cashBenefit, pointsBenefit],
      });

      // Cash booking → only cashBenefit
      const resCash = calculateMatchedPromotions(cashBooking, [promo], new Map(), mockValuations);
      expect(resCash[0].benefitApplications).toHaveLength(1);
      expect(resCash[0].benefitApplications[0].promotionBenefitId).toBe("b-cash");

      // Points booking → only pointsBenefit
      const resPoints = calculateMatchedPromotions(
        pointsBooking,
        [promo],
        new Map(),
        mockValuations
      );
      expect(resPoints[0].benefitApplications).toHaveLength(1);
      expect(resPoints[0].benefitApplications[0].promotionBenefitId).toBe("b-points");

      // Mixed booking → none (both benefits restricted to single types)
      expect(
        calculateMatchedPromotions(mixedBooking, [promo], new Map(), mockValuations)
      ).toHaveLength(0);
    });
  });
});

describe("getConstrainedPromotions", () => {
  it("should include promotions with promotion-level constraints", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ maxStayCount: 5 }),
    });
    expect(getConstrainedPromotions([promo])).toHaveLength(1);
  });

  it("should include tiered promotions", () => {
    const promo = makePromo({
      tiers: [
        {
          id: "tier-1",
          minStays: 1,
          maxStays: 5,
          benefits: [],
        },
      ],
    });
    expect(getConstrainedPromotions([promo])).toHaveLength(1);
  });

  it("should include promotions with benefit-level constraints", () => {
    const promo = makePromo({
      restrictions: null,
      benefits: [
        {
          id: "benefit-constrained",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ maxRedemptionValue: new Prisma.Decimal(100) }),
        },
      ],
    });
    expect(getConstrainedPromotions([promo])).toHaveLength(1);
  });

  it("should exclude promotions without any constraints", () => {
    const promo = makePromo({
      restrictions: null,
      benefits: [
        {
          id: "benefit-simple",
          rewardType: PromotionRewardType.cashback,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(10),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    });
    expect(getConstrainedPromotions([promo])).toHaveLength(0);
  });
});

describe("spanStays", () => {
  const promo = makePromo({
    restrictions: makeRestrictions({ minNightsRequired: 3, spanStays: true }),
    benefits: [
      {
        id: "benefit-span",
        rewardType: PromotionRewardType.points,
        valueType: PromotionBenefitValueType.fixed,
        value: new Prisma.Decimal(3000),
        certType: null,
        pointsMultiplierBasis: null,
        sortOrder: 0,
        restrictions: null,
      },
    ],
  });

  it("should apply proportional reward for a single stay below min nights", () => {
    const booking = {
      ...mockBooking,
      numNights: 1,
      loyaltyPointsEarned: 0,
      hotelChain: {
        ...mockBooking.hotelChain,
        pointType: { centsPerPoint: 0.02 },
      },
    };
    const matched = calculateMatchedPromotions(booking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    expect(matched[0].appliedValue).toBe(20); // (1/3) * (3000 pts * 0.02 $/pt) = 20
    expect(matched[0].bonusPointsApplied).toBe(1000); // (1/3) * 3000
  });

  it("should apply multiple rewards across stays spanning increments", () => {
    // 1st stay: 2 nights
    const booking1 = { ...mockBooking, numNights: 2 };
    const matched1 = calculateMatchedPromotions(booking1, [promo], new Map(), mockValuations);
    expect(matched1[0].bonusPointsApplied).toBe(2000);

    // 2nd stay: 2 nights (total 4 nights)
    const booking2 = { ...mockBooking, numNights: 2 };
    // Prior usage has 2 nights
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 40,
          totalBonusPoints: 2000,
          eligibleStayNights: 2,
          benefitUsage: new Map(),
        },
      ],
    ]);

    const matched2 = calculateMatchedPromotions(booking2, [promo], priorUsage, mockValuations);
    expect(matched2[0].bonusPointsApplied).toBe(2000);
    // Total bonus points across both stays = 4000 (for 4 nights @ 1000/night)
  });

  it("should respect benefit-level maxTotalBonusPoints", () => {
    const promo = makePromo({
      benefits: [
        {
          id: "benefit-pts-limit",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(3000),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: makeRestrictions({ maxTotalBonusPoints: 5000 }),
        },
      ],
    });
    const priorUsage = new Map([
      [
        promo.id,
        {
          count: 1,
          totalValue: 60,
          totalBonusPoints: 3000,
          benefitUsage: new Map([
            ["benefit-pts-limit", { count: 1, totalValue: 60, totalBonusPoints: 3000 }],
          ]),
        },
      ],
    ]);
    const booking = {
      ...mockBooking,
      numNights: 1,
      hotelChain: {
        ...mockBooking.hotelChain,
        pointType: { centsPerPoint: 0.02 },
      },
    };
    const matched = calculateMatchedPromotions(booking, [promo], priorUsage, mockValuations);
    expect(matched).toHaveLength(1);
    // 3000 pts value, but only 2000 capacity.
    expect(matched[0].bonusPointsApplied).toBe(2000);
    expect(matched[0].appliedValue).toBe(40); // 2000 pts * 0.02 $/pt
  });

  it("should enforce promotion-level points cap across multiple benefits", () => {
    const promo = makePromo({
      restrictions: makeRestrictions({ maxTotalBonusPoints: 5000 }),
      benefits: [
        {
          id: "b1",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(4000),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
        {
          id: "b2",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(2000),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 1,
          restrictions: null,
        },
      ],
    });

    const matched = calculateMatchedPromotions(mockBooking, [promo], new Map(), mockValuations);
    expect(matched).toHaveLength(1);
    // Total requested: 6000. Cap: 5000.
    expect(matched[0].bonusPointsApplied).toBe(5000);
    // Applied value should be scaled: 5000 * 0.015 $/pt = 75
    expect(matched[0].appliedValue).toBe(75);
  });
});
