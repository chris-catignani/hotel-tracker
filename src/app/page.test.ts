import { describe, it, expect, vi, afterEach } from "vitest";
import { getNetCostBreakdown } from "@/lib/net-cost";
import { calcTotalSavings, buildRawBreakdown } from "./page";

vi.mock("@/lib/net-cost", () => ({
  getNetCostBreakdown: vi.fn().mockReturnValue({
    promoSavings: 10,
    portalCashback: 5,
    cardReward: 8,
    loyaltyPointsValue: 12,
    bookingBenefitsValue: 25,
    cardBenefitSavings: 7,
    partnershipEarnsValue: 3,
  }),
}));

describe("calcTotalSavings", () => {
  it("includes all savings types in the total", () => {
    // 10 + 5 + 8 + 12 + 25 + 7 + 3 = 70
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = calcTotalSavings({} as any);
    expect(result).toBe(70);
    expect(getNetCostBreakdown).toHaveBeenCalledWith({});
  });
});

describe("buildRawBreakdown", () => {
  afterEach(() => {
    // Restore the global mock default so calcTotalSavings tests are unaffected
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      promoSavings: 10,
      portalCashback: 5,
      cardReward: 8,
      loyaltyPointsValue: 12,
      bookingBenefitsValue: 25,
      cardBenefitSavings: 7,
      partnershipEarnsValue: 3,
    } as ReturnType<typeof getNetCostBreakdown>);
  });
  function makeBooking(
    overrides: Record<string, unknown> = {}
  ): Parameters<typeof buildRawBreakdown>[0][number] {
    return {
      id: "bk1",
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
      numNights: 2,
      pretaxCost: "200",
      taxAmount: "20",
      totalCost: "220",
      currency: "USD",
      lockedExchangeRate: 1,
      portalCashbackRate: null,
      portalCashbackOnTotal: false,
      loyaltyPointsEarned: null,
      pointsRedeemed: null,
      notes: null,
      hotelChainId: null,
      accommodationType: "hotel",
      needsReview: false,
      otaAgencyId: null,
      bookingSource: null,
      hotelChain: null,
      hotelChainSubBrand: null,
      userCreditCard: null,
      shoppingPortal: null,
      bookingPromotions: [],
      certificates: [],
      benefits: [],
      bookingCardBenefits: [],
      partnershipEarns: [],
      property: { name: "Test Hotel", countryCode: "US", city: "NYC" },
      ...overrides,
    } as Parameters<typeof buildRawBreakdown>[0][number];
  }

  it("returns empty array when there are no bookings", () => {
    expect(buildRawBreakdown([])).toEqual([]);
  });

  it("returns empty array when all categories have zero value", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 220,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);
    expect(buildRawBreakdown([makeBooking()])).toEqual([]);
  });

  it("loyalty: groups by hotel chain name, shows points count and program name", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 25,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 195,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      loyaltyPointsEarned: 2000,
      hotelChain: {
        id: "hc1",
        name: "Hyatt",
        loyaltyProgram: "World of Hyatt",
        basePointRate: "5",
        pointType: { name: "World of Hyatt pts", shortName: "Hyatt", usdCentsPerPoint: "1.25" },
        userStatus: null,
        hotelChainSubBrands: [],
        eliteStatuses: [],
      },
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Loyalty Points Value");
    expect(cat).toBeDefined();
    expect(cat!.programs).toHaveLength(1);
    expect(cat!.programs[0]).toMatchObject({
      name: "Hyatt",
      nativeAmount: 2000,
      nativeUnit: "Hyatt",
      isPoints: true,
    });
  });

  it("loyalty: accumulates points across multiple bookings at the same chain", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 25,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 195,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const chain = {
      id: "hc1",
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: "5",
      pointType: { name: "World of Hyatt pts", shortName: "Hyatt", usdCentsPerPoint: "1.25" },
      userStatus: null,
      hotelChainSubBrands: [],
      eliteStatuses: [],
    };
    const b1 = makeBooking({ loyaltyPointsEarned: 2000, hotelChain: chain });
    const b2 = makeBooking({ id: "bk2", loyaltyPointsEarned: 3000, hotelChain: chain });

    const result = buildRawBreakdown([b1, b2]);
    const cat = result.find((c) => c.label === "Loyalty Points Value");
    expect(cat!.programs[0].nativeAmount).toBe(5000);
  });

  it("loyalty: produces separate entries for different hotel chains", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 25,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 195,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const b1 = makeBooking({
      loyaltyPointsEarned: 2000,
      hotelChain: {
        id: "hc1",
        name: "Hyatt",
        loyaltyProgram: null,
        basePointRate: "5",
        pointType: { name: "Hyatt pts", shortName: "Hyatt", usdCentsPerPoint: "1.25" },
        userStatus: null,
        hotelChainSubBrands: [],
        eliteStatuses: [],
      },
    });
    const b2 = makeBooking({
      id: "bk2",
      loyaltyPointsEarned: 1500,
      hotelChain: {
        id: "hc2",
        name: "Marriott",
        loyaltyProgram: null,
        basePointRate: "10",
        pointType: { name: "Marriott Bonvoy pts", shortName: "Bonvoy", usdCentsPerPoint: "0.6" },
        userStatus: null,
        hotelChainSubBrands: [],
        eliteStatuses: [],
      },
    });

    const result = buildRawBreakdown([b1, b2]);
    const cat = result.find((c) => c.label === "Loyalty Points Value");
    expect(cat!.programs).toHaveLength(2);
    const names = cat!.programs.map((p) => p.name);
    expect(names).toContain("Hyatt");
    expect(names).toContain("Marriott");
  });

  it("card rewards: shows points count for points-type card, grouped by point type", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 15,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 205,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      userCreditCard: {
        creditCard: {
          id: "cc1",
          name: "Amex Platinum",
          rewardType: "points",
          rewardRate: "5",
          pointTypeId: "pt1",
          pointType: { name: "Amex MR pts", shortName: "MR", usdCentsPerPoint: "0.015" },
          rewardRules: [],
        },
        creditCardId: "cc1",
        id: "ucc1",
        nickname: null,
        userId: "u1",
      },
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Card Rewards");
    expect(cat).toBeDefined();
    // 15 USD / 0.015 USD-per-point = 1000 pts; keyed by point type name, unit uses shortName
    expect(cat!.programs[0]).toMatchObject({
      name: "Amex MR pts",
      nativeAmount: 1000,
      nativeUnit: "MR",
      isPoints: true,
    });
  });

  it("card rewards: combines two cards with the same point type", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 15,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 205,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const amexPt = { name: "Amex MR pts", shortName: "MR", usdCentsPerPoint: "0.015" };
    const b1 = makeBooking({
      userCreditCard: {
        creditCard: {
          id: "cc1",
          name: "Amex Platinum",
          rewardType: "points",
          rewardRate: "5",
          pointTypeId: "pt1",
          pointType: amexPt,
          rewardRules: [],
        },
        creditCardId: "cc1",
        id: "ucc1",
        nickname: null,
        userId: "u1",
      },
    });
    const b2 = makeBooking({
      id: "bk2",
      userCreditCard: {
        creditCard: {
          id: "cc2",
          name: "Amex Gold",
          rewardType: "points",
          rewardRate: "4",
          pointTypeId: "pt1",
          pointType: amexPt,
          rewardRules: [],
        },
        creditCardId: "cc2",
        id: "ucc2",
        nickname: null,
        userId: "u1",
      },
    });

    const result = buildRawBreakdown([b1, b2]);
    const cat = result.find((c) => c.label === "Card Rewards");
    expect(cat!.programs).toHaveLength(1);
    expect(cat!.programs[0].name).toBe("Amex MR pts");
    // 2 bookings × 1000 pts each = 2000 pts
    expect(cat!.programs[0].nativeAmount).toBe(2000);
  });

  it("card rewards: shows dollar amount for cash-type card", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 22,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 198,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      userCreditCard: {
        creditCard: {
          id: "cc2",
          name: "Citi Double Cash",
          rewardType: "cash",
          rewardRate: "2",
          pointTypeId: null,
          pointType: null,
          rewardRules: [],
        },
        creditCardId: "cc2",
        id: "ucc2",
        nickname: null,
        userId: "u1",
      },
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Card Rewards");
    expect(cat!.programs[0]).toMatchObject({
      name: "cash",
      nativeAmount: 22,
      nativeUnit: "cash",
      isPoints: false,
    });
  });

  it("portal cashback: shows points for points-type portal", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 10,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 210,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      shoppingPortal: {
        id: "sp1",
        name: "Chase Travel",
        rewardType: "points",
        pointTypeId: "pt2",
        pointType: { name: "Chase UR pts", shortName: "UR", usdCentsPerPoint: "0.01" },
      },
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Portal Cashback");
    // 10 USD / 0.01 USD-per-point = 1000 pts; nativeUnit uses shortName
    expect(cat!.programs[0]).toMatchObject({
      name: "Chase Travel",
      nativeAmount: 1000,
      nativeUnit: "UR",
      isPoints: true,
    });
  });

  it("promotions: itemized by promotion name in USD", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 60,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 160,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      bookingPromotions: [
        {
          id: "bp1",
          bookingId: "bk1",
          promotionId: "p1",
          appliedValue: "40",
          autoApplied: true,
          postingStatus: "posted" as const,
          promotion: {
            id: "p1",
            name: "Hyatt Q1 Bonus",
            type: "loyalty",
            value: "40",
            valueType: "fixed",
            restrictions: null,
          },
        },
        {
          id: "bp2",
          bookingId: "bk1",
          promotionId: "p2",
          appliedValue: "20",
          autoApplied: false,
          postingStatus: "posted" as const,
          promotion: {
            id: "p2",
            name: "Double Nights Promo",
            type: "loyalty",
            value: "20",
            valueType: "fixed",
            restrictions: null,
          },
        },
      ],
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Promotion Savings");
    expect(cat!.programs).toHaveLength(2);
    expect(cat!.programs.find((p) => p.name === "Hyatt Q1 Bonus")?.nativeAmount).toBe(40);
    expect(cat!.programs.find((p) => p.name === "Double Nights Promo")?.nativeAmount).toBe(20);
    expect(cat!.programs[0].isPoints).toBe(false);
  });

  it("promotions: shows points count for points-type promo", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 5,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 215,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      hotelChain: {
        id: "hc1",
        name: "IHG",
        loyaltyProgram: "IHG One Rewards",
        basePointRate: "10",
        pointType: { name: "IHG pts", shortName: "IHG", usdCentsPerPoint: "0.005" },
        userStatus: null,
        hotelChainSubBrands: [],
        eliteStatuses: [],
      },
      bookingPromotions: [
        {
          id: "bp1",
          bookingId: "bk1",
          promotionId: "p1",
          appliedValue: "5",
          bonusPointsApplied: 1000,
          autoApplied: true,
          postingStatus: "posted" as const,
          promotion: {
            id: "p1",
            name: "IHG 2x Promo",
            type: "loyalty",
            value: "2",
            valueType: "multiplier",
            restrictions: null,
          },
          benefitApplications: [
            {
              appliedValue: "5",
              promotionBenefit: {
                rewardType: "points",
                valueType: "multiplier",
                value: "2",
                certType: null,
              },
            },
          ],
        },
      ],
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Promotion Savings");
    expect(cat!.programs[0]).toMatchObject({
      name: "IHG 2x Promo",
      nativeAmount: 1000,
      nativeUnit: "IHG",
      isPoints: true,
    });
  });

  it("promotions: mixed points+eqn promo emits two separate entries", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 20.5,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 199.5,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      hotelChain: {
        id: "hc1",
        name: "Marriott",
        loyaltyProgram: "Bonvoy",
        basePointRate: "10",
        pointType: { name: "Marriott Bonvoy pts", shortName: "Bonvoy", usdCentsPerPoint: "0.007" },
        userStatus: null,
        hotelChainSubBrands: [],
        eliteStatuses: [],
      },
      bookingPromotions: [
        {
          id: "bp1",
          bookingId: "bk1",
          promotionId: "p1",
          appliedValue: "20.5",
          bonusPointsApplied: 1500,
          autoApplied: true,
          postingStatus: "posted" as const,
          promotion: {
            id: "p1",
            name: "Marriott Global Q1",
            type: "loyalty",
            value: "0",
            valueType: "fixed",
            restrictions: null,
          },
          benefitApplications: [
            {
              appliedValue: "10.5",
              promotionBenefit: {
                rewardType: "points",
                valueType: "fixed",
                value: "1500",
                certType: null,
              },
            },
            {
              appliedValue: "10",
              promotionBenefit: {
                rewardType: "eqn",
                valueType: "fixed",
                value: "1",
                certType: null,
              },
            },
          ],
        },
      ],
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Promotion Savings");
    expect(cat!.programs).toHaveLength(2);
    expect(cat!.programs.find((p) => p.name === "Marriott Global Q1")).toMatchObject({
      nativeAmount: 1500,
      nativeUnit: "Bonvoy",
      isPoints: true,
    });
    expect(cat!.programs.find((p) => p.name === "Marriott Global Q1 (EQN)")).toMatchObject({
      nativeAmount: 1, // 10 USD / DEFAULT_EQN_VALUE ($10) = 1 EQN
      nativeUnit: "EQN",
      isPoints: true,
    });
  });

  it("partnership earns: shows points by partner name", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 45,
      netCost: 175,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      partnershipEarns: [
        {
          id: "pe1",
          name: "Alaska Airlines",
          pointsEarned: 3200,
          earnedValue: 45,
          pointTypeName: "Alaska miles",
        },
      ],
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Partnership Earns");
    expect(cat!.programs[0]).toMatchObject({
      name: "Alaska Airlines",
      nativeAmount: 3200,
      nativeUnit: "Alaska miles",
      isPoints: true,
    });
  });

  it("card benefits: itemized by description in USD", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 50,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 170,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      bookingCardBenefits: [
        { id: "bcb1", cardBenefit: { description: "Annual Hotel Credit" }, appliedValue: "50" },
      ],
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Card Benefits");
    expect(cat!.programs[0]).toMatchObject({
      name: "Annual Hotel Credit",
      nativeAmount: 50,
      nativeUnit: "cash",
      isPoints: false,
    });
  });

  it("booking benefits: itemized by label in USD", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 30,
      partnershipEarnsValue: 0,
      netCost: 190,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      benefits: [
        {
          id: "ben1",
          label: "Free Breakfast",
          dollarValue: "30",
          benefitType: "complimentary",
          pointsEarnType: null,
          pointsAmount: null,
          pointsMultiplier: null,
        },
      ],
    });

    const result = buildRawBreakdown([booking]);
    const cat = result.find((c) => c.label === "Booking Benefits");
    expect(cat!.programs[0]).toMatchObject({
      name: "Free Breakfast",
      nativeAmount: 30,
      nativeUnit: "cash",
      isPoints: false,
    });
  });

  it("categories are sorted descending by USD value", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 15,
      portalCashback: 0,
      loyaltyPointsValue: 50,
      promoSavings: 30,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 125,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      loyaltyPointsEarned: 4000,
      hotelChain: {
        id: "hc1",
        name: "Hyatt",
        loyaltyProgram: null,
        basePointRate: "5",
        pointType: { name: "Hyatt pts", shortName: "Hyatt", usdCentsPerPoint: "0.0125" },
        userStatus: null,
        hotelChainSubBrands: [],
        eliteStatuses: [],
      },
      userCreditCard: {
        creditCard: {
          id: "cc1",
          name: "Amex Platinum",
          rewardType: "points",
          rewardRate: "5",
          pointTypeId: "pt1",
          pointType: { name: "Amex MR pts", shortName: "MR", usdCentsPerPoint: "0.015" },
          rewardRules: [],
        },
        creditCardId: "cc1",
        id: "ucc1",
        nickname: null,
        userId: "u1",
      },
      bookingPromotions: [
        {
          id: "bp1",
          bookingId: "bk1",
          promotionId: "p1",
          appliedValue: "30",
          autoApplied: true,
          postingStatus: "posted" as const,
          promotion: {
            id: "p1",
            name: "Q1 Bonus",
            type: "loyalty",
            value: "30",
            valueType: "fixed",
            restrictions: null,
          },
        },
      ],
    });

    const result = buildRawBreakdown([booking]);
    const usdValues = result.map((c) => c.usdValue);
    expect(usdValues).toEqual([...usdValues].sort((a, b) => b - a));
  });

  it("categories with zero USD value are excluded", () => {
    vi.mocked(getNetCostBreakdown).mockReturnValue({
      cardReward: 0,
      portalCashback: 0,
      loyaltyPointsValue: 25,
      promoSavings: 0,
      cardBenefitSavings: 0,
      bookingBenefitsValue: 0,
      partnershipEarnsValue: 0,
      netCost: 195,
      totalCost: 0,
      pointsRedeemedValue: 0,
      certsValue: 0,
      partnershipEarns: [],
      bookingBenefits: [],
      promotions: [],
    } as ReturnType<typeof getNetCostBreakdown>);

    const booking = makeBooking({
      loyaltyPointsEarned: 2000,
      hotelChain: {
        id: "hc1",
        name: "Hyatt",
        loyaltyProgram: null,
        basePointRate: "5",
        pointType: { name: "Hyatt pts", shortName: "Hyatt", usdCentsPerPoint: "1.25" },
        userStatus: null,
        hotelChainSubBrands: [],
        eliteStatuses: [],
      },
    });

    const result = buildRawBreakdown([booking]);
    const labels = result.map((c) => c.label);
    expect(labels).toContain("Loyalty Points Value");
    expect(labels).not.toContain("Card Rewards");
    expect(labels).not.toContain("Portal Cashback");
    expect(labels).not.toContain("Promotion Savings");
  });
});
