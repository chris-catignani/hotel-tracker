import { describe, it, expect } from "vitest";
import {
  calculateMatchedPromotions,
  PromotionUsageMap,
  MatchingBooking,
} from "./promotion-matching";
import {
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";

describe("Promotion Matching - Regression Tests (#166 Bugs)", () => {
  const mockHotelChain = {
    id: "ihg",
    basePointRate: new Prisma.Decimal(10),
    pointType: { centsPerPoint: new Prisma.Decimal(0.006) },
  };

  const createBooking = (overrides: Partial<MatchingBooking>): MatchingBooking => ({
    creditCardId: "some-cc",
    shoppingPortalId: "some-portal",
    hotelChainId: "ihg",
    hotelChainSubBrandId: "holiday-inn",
    checkIn: new Date("2026-03-07"),
    createdAt: new Date("2026-03-01"),
    numNights: 1,
    pretaxCost: new Prisma.Decimal(100),
    totalCost: new Prisma.Decimal(120),
    pointsRedeemed: 0,
    loyaltyPointsEarned: 1000,
    hotelChain: mockHotelChain,
    ...overrides,
  });

  it("should match loyalty promotion even if booking has credit card and portal (Filtering Fix)", () => {
    const promo = {
      id: "ihg-eqn",
      name: "IHG Bonus EQN",
      type: PromotionType.loyalty,
      hotelChainId: "ihg",
      creditCardId: null,
      shoppingPortalId: null,
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: null,
      benefits: [
        {
          id: "b1",
          rewardType: PromotionRewardType.eqn,
          valueType: PromotionBenefitValueType.fixed,
          value: new Prisma.Decimal(1),
          certType: null,
          pointsMultiplierBasis: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
      tiers: [],
    };

    // This booking HAS a CC and Portal.
    // The bug was that the matcher filtered for CC=null/Portal=null for loyalty promos.
    const matched = calculateMatchedPromotions(createBooking({}), [promo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].promotionId).toBe("ihg-eqn");
  });

  it("should correctly evaluate prerequisiteStayCount from prior usage (Prerequisite Fix)", () => {
    const promo = {
      id: "ihg-2x",
      name: "IHG 2x Promo",
      type: PromotionType.loyalty,
      hotelChainId: "ihg",
      creditCardId: null,
      shoppingPortalId: null,
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: {
        prerequisiteStayCount: 1, // Requires 1 prior stay
        prerequisiteNightCount: null,
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
      },
      benefits: [
        {
          id: "b1",
          rewardType: PromotionRewardType.points,
          valueType: PromotionBenefitValueType.multiplier,
          value: new Prisma.Decimal(2),
          certType: null,
          pointsMultiplierBasis: "base_only",
          sortOrder: 0,
          restrictions: null,
        },
      ],
      tiers: [],
    };

    // 1. Scenario: No prior stays
    const usage0: PromotionUsageMap = new Map();
    const matched0 = calculateMatchedPromotions(createBooking({}), [promo], usage0);
    expect(matched0).toHaveLength(0);

    // 2. Scenario: 1 prior stay (meets prerequisite)
    const usage1: PromotionUsageMap = new Map([
      ["ihg-2x", { count: 0, totalValue: 0, totalBonusPoints: 0, eligibleStayCount: 1 }],
    ]);
    const matched1 = calculateMatchedPromotions(createBooking({}), [promo], usage1);
    expect(matched1).toHaveLength(1);
    expect(matched1[0].bonusPointsApplied).toBe(1000); // 100 pretax * 10 rate * (2-1) mult
  });
});
