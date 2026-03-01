import { describe, it, expect } from "vitest";
import { calculateMatchedPromotions, MatchingBooking } from "./promotion-matching";
import {
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";

describe("Promotion Matching - Booking Source Restriction", () => {
  const mockHotelChain = {
    id: "hyatt",
    basePointRate: new Prisma.Decimal(5),
    pointType: { centsPerPoint: new Prisma.Decimal(1.5) },
  };

  const createBooking = (overrides: Partial<MatchingBooking>): MatchingBooking => ({
    creditCardId: null,
    shoppingPortalId: null,
    hotelChainId: "hyatt",
    hotelChainSubBrandId: "hyatt-place",
    bookingSource: "direct_app",
    checkIn: new Date("2026-03-01"),
    createdAt: new Date("2026-01-01"),
    numNights: 1,
    pretaxCost: new Prisma.Decimal(100),
    totalCost: new Prisma.Decimal(120),
    pointsRedeemed: 0,
    loyaltyPointsEarned: 500,
    hotelChain: mockHotelChain,
    ...overrides,
  });

  const baseBenefit = {
    id: "b1",
    rewardType: PromotionRewardType.points,
    valueType: PromotionBenefitValueType.fixed,
    value: new Prisma.Decimal(1000),
    certType: null,
    pointsMultiplierBasis: null,
    sortOrder: 0,
    restrictions: null,
  };

  it("should match if booking source is allowed at promotion level", () => {
    const promo = {
      id: "app-promo",
      type: PromotionType.loyalty,
      hotelChainId: "hyatt",
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: {
        allowedBookingSources: ["direct_app"],
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
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
      },
      benefits: [baseBenefit],
      tiers: [],
    };

    const matched = calculateMatchedPromotions(createBooking({ bookingSource: "direct_app" }), [
      promo,
    ]);
    expect(matched).toHaveLength(1);
  });

  it("should NOT match if booking source is not allowed at promotion level", () => {
    const promo = {
      id: "app-promo",
      type: PromotionType.loyalty,
      hotelChainId: "hyatt",
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: {
        allowedBookingSources: ["direct_app"],
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
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
      },
      benefits: [baseBenefit],
      tiers: [],
    };

    const matched = calculateMatchedPromotions(createBooking({ bookingSource: "direct_web" }), [
      promo,
    ]);
    expect(matched).toHaveLength(0);
  });

  it("should match if allowedBookingSources is empty (all sources allowed)", () => {
    const promo = {
      id: "any-source",
      type: PromotionType.loyalty,
      hotelChainId: "hyatt",
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: {
        allowedBookingSources: [],
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
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
      },
      benefits: [baseBenefit],
      tiers: [],
    };

    const matched = calculateMatchedPromotions(createBooking({ bookingSource: "ota" }), [promo]);
    expect(matched).toHaveLength(1);
  });

  it("should match if booking source is allowed at benefit level", () => {
    const promo = {
      id: "mixed-promo",
      type: PromotionType.loyalty,
      hotelChainId: "hyatt",
      isActive: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      restrictions: null,
      benefits: [
        {
          ...baseBenefit,
          id: "app-only-benefit",
          restrictions: {
            allowedBookingSources: ["direct_app"],
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
            prerequisiteStayCount: null,
            prerequisiteNightCount: null,
          },
        },
      ],
      tiers: [],
    };

    // 1. Matches on App
    const matched1 = calculateMatchedPromotions(createBooking({ bookingSource: "direct_app" }), [
      promo,
    ]);
    expect(matched1).toHaveLength(1);
    expect(matched1[0].benefitApplications).toHaveLength(1);

    // 2. Skips on Web
    const matched2 = calculateMatchedPromotions(createBooking({ bookingSource: "direct_web" }), [
      promo,
    ]);
    expect(matched2).toHaveLength(0);
  });
});
