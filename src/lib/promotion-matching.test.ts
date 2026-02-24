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
});
