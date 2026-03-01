import { describe, it, expect } from "vitest";
import {
  calculateMatchedPromotions,
  MatchingBooking,
  MatchingPromotion,
} from "./promotion-matching";
import {
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";

describe("Promotion Matching - Hotel Chain Restriction", () => {
  const mockHyatt = {
    id: "hyatt",
    basePointRate: new Prisma.Decimal(5),
    pointType: { centsPerPoint: new Prisma.Decimal(1.5) },
  };

  const createBooking = (overrides: Partial<MatchingBooking>): MatchingBooking => ({
    creditCardId: "cc-1",
    shoppingPortalId: null,
    hotelChainId: "hyatt",
    hotelChainSubBrandId: "hyatt-place",
    bookingSource: null,
    checkIn: new Date("2026-03-01"),
    createdAt: new Date("2026-01-01"),
    numNights: 1,
    pretaxCost: new Prisma.Decimal(100),
    totalCost: new Prisma.Decimal(120),
    pointsRedeemed: 0,
    loyaltyPointsEarned: 500,
    hotelChain: mockHyatt,
    ...overrides,
  });

  const baseBenefit = {
    id: "b1",
    rewardType: PromotionRewardType.cashback,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(10),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
    restrictions: null,
  };

  it("should match Credit Card promo if chain matches restriction", () => {
    const promo = {
      id: "cc-hyatt-only",
      type: PromotionType.credit_card,
      creditCardId: "cc-1",
      shoppingPortalId: null,
      hotelChainId: null,
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: {
        hotelChainId: "hyatt", // Restricted to Hyatt
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
        allowedBookingSources: [],
        subBrandRestrictions: [],
        tieInCards: [],
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
      },
      benefits: [baseBenefit],
      tiers: [],
    } as unknown as MatchingPromotion;

    const matched = calculateMatchedPromotions(createBooking({ hotelChainId: "hyatt" }), [promo]);
    expect(matched).toHaveLength(1);
  });

  it("should NOT match Credit Card promo if chain differs from restriction", () => {
    const promo = {
      id: "cc-hyatt-only",
      type: PromotionType.credit_card,
      creditCardId: "cc-1",
      shoppingPortalId: null,
      hotelChainId: null,
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: {
        hotelChainId: "hyatt",
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
        allowedBookingSources: [],
        subBrandRestrictions: [],
        tieInCards: [],
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
      },
      benefits: [baseBenefit],
      tiers: [],
    } as unknown as MatchingPromotion;

    const matched = calculateMatchedPromotions(createBooking({ hotelChainId: "marriott" }), [
      promo,
    ]);
    expect(matched).toHaveLength(0);
  });

  it("should respect benefit-level hotel chain restriction", () => {
    const promo = {
      id: "cc-multi-benefit",
      type: PromotionType.credit_card,
      creditCardId: "cc-1",
      shoppingPortalId: null,
      hotelChainId: null,
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: null,
      benefits: [
        {
          ...baseBenefit,
          id: "hyatt-only-reward",
          restrictions: {
            hotelChainId: "hyatt",
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
            allowedBookingSources: [],
            subBrandRestrictions: [],
            tieInCards: [],
            prerequisiteStayCount: null,
            prerequisiteNightCount: null,
          },
        },
      ],
      tiers: [],
    } as unknown as MatchingPromotion;

    // 1. Matches on Hyatt
    const matched1 = calculateMatchedPromotions(createBooking({ hotelChainId: "hyatt" }), [promo]);
    expect(matched1).toHaveLength(1);
    expect(matched1[0].benefitApplications).toHaveLength(1);

    // 2. Skips on Hilton
    const matched2 = calculateMatchedPromotions(createBooking({ hotelChainId: "hilton" }), [promo]);
    expect(matched2).toHaveLength(0);
  });
});
