import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    promotion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    userPromotion: {
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    promotionRestrictions: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    promotionSubBrandRestriction: {
      deleteMany: vi.fn(),
    },
    promotionRestrictionTieInCard: {
      deleteMany: vi.fn(),
    },
    promotionBenefit: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    promotionTier: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/promotion-apply", () => ({
  matchPromotionsForAffectedBookings: vi.fn().mockResolvedValue(undefined),
  reevaluateBookings: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/prisma";
import { matchPromotionsForAffectedBookings, reevaluateBookings } from "@/services/promotion-apply";
import {
  getPromotion,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from "./promotion.service";
import type { PromotionBenefitFormData } from "@/lib/types";

const prismaMock = prisma as unknown as {
  promotion: {
    findFirst: Mock;
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
  };
  booking: { findMany: Mock };
  userPromotion: { create: Mock; upsert: Mock; deleteMany: Mock };
  promotionRestrictions: { create: Mock; update: Mock; delete: Mock; deleteMany: Mock };
  promotionSubBrandRestriction: { deleteMany: Mock };
  promotionRestrictionTieInCard: { deleteMany: Mock };
  promotionBenefit: { findMany: Mock; deleteMany: Mock };
  promotionTier: { findMany: Mock; deleteMany: Mock };
  $transaction: Mock;
};

const mockPromotion = {
  id: "promo-1",
  name: "Summer Bonus",
  type: "LOYALTY",
  hotelChain: null,
  creditCard: null,
  shoppingPortal: null,
  restrictions: null,
  benefits: [],
  tiers: [],
  userPromotions: [],
};

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// getPromotion
// ---------------------------------------------------------------------------

describe("getPromotion", () => {
  it("returns the promotion when found", async () => {
    prismaMock.promotion.findFirst.mockResolvedValueOnce(mockPromotion);

    const result = await getPromotion("promo-1", "user-1");

    expect(prismaMock.promotion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "promo-1", userId: "user-1" } })
    );
    expect(result).toEqual(mockPromotion);
  });

  it("throws AppError(404) when promotion not found", async () => {
    prismaMock.promotion.findFirst.mockResolvedValueOnce(null);

    await expect(getPromotion("promo-1", "user-1")).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// listPromotions
// ---------------------------------------------------------------------------

describe("listPromotions", () => {
  it("returns all promotions when no type filter provided", async () => {
    prismaMock.promotion.findMany.mockResolvedValueOnce([mockPromotion]);

    const result = await listPromotions("user-1");

    expect(prismaMock.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    expect(result).toEqual([mockPromotion]);
  });

  it("passes type filter to Prisma query", async () => {
    prismaMock.promotion.findMany.mockResolvedValueOnce([mockPromotion]);

    await listPromotions("user-1", "LOYALTY");

    expect(prismaMock.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: "LOYALTY" } })
    );
  });
});

// ---------------------------------------------------------------------------
// createPromotion
// ---------------------------------------------------------------------------

describe("createPromotion", () => {
  const baseInput = {
    name: "Summer Bonus",
    type: "loyalty" as const,
    benefits: [
      {
        rewardType: "points" as const,
        valueType: "fixed" as const,
        value: 1000,
        certType: null,
        sortOrder: 0,
        restrictions: null,
      },
    ],
    tiers: undefined,
    hotelChainId: null,
    creditCardId: null,
    shoppingPortalId: null,
    startDate: null,
    endDate: null,
    restrictions: null,
  };

  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)
    );
    prismaMock.promotion.create.mockResolvedValue({ id: "promo-1" });
    prismaMock.promotion.findUnique.mockResolvedValue(mockPromotion);
  });

  it("creates promotion with flat benefits (no tiers)", async () => {
    const result = await createPromotion("user-1", baseInput);

    expect(prismaMock.promotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Summer Bonus",
          type: "loyalty",
          user: { connect: { id: "user-1" } },
          benefits: expect.objectContaining({ create: expect.any(Array) }),
        }),
      })
    );
    expect(result).toEqual(mockPromotion);
  });

  it("creates promotion with tiers when tiers array is non-empty", async () => {
    const inputWithTiers = {
      ...baseInput,
      tiers: [{ minStays: 1, maxStays: null, minNights: null, maxNights: null, benefits: [] }],
    };

    await createPromotion("user-1", inputWithTiers);

    expect(prismaMock.promotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tiers: expect.objectContaining({ create: expect.any(Array) }),
        }),
      })
    );
    // flat benefits should NOT appear when tiers are present
    const callArg = prismaMock.promotion.create.mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty("benefits");
  });

  it("creates UserPromotion when registrationDate is provided", async () => {
    const inputWithReg = {
      ...baseInput,
      restrictions: { registrationDate: "2026-06-01" } as unknown as typeof baseInput.restrictions,
    };

    await createPromotion("user-1", inputWithReg);

    expect(prismaMock.userPromotion.create).toHaveBeenCalledWith({
      data: {
        promotionId: "promo-1",
        userId: "user-1",
        registrationDate: new Date("2026-06-01"),
      },
    });
  });

  it("does NOT create UserPromotion when registrationDate is absent", async () => {
    await createPromotion("user-1", baseInput);

    expect(prismaMock.userPromotion.create).not.toHaveBeenCalled();
  });

  it("calls matchPromotionsForAffectedBookings with promotion id and userId", async () => {
    await createPromotion("user-1", baseInput);

    expect(matchPromotionsForAffectedBookings).toHaveBeenCalledWith("promo-1", "user-1");
  });

  it("re-fetches promotion via findUnique after create to get full relations", async () => {
    await createPromotion("user-1", baseInput);

    expect(prismaMock.promotion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "promo-1" } })
    );
  });
});

// ---------------------------------------------------------------------------
// updatePromotion
// ---------------------------------------------------------------------------

describe("updatePromotion", () => {
  const baseUpdateInput = {
    name: "Updated Promo",
    type: "loyalty" as const,
    benefits: [] as PromotionBenefitFormData[],
    tiers: undefined as undefined,
    hotelChainId: undefined as undefined,
    creditCardId: undefined as undefined,
    shoppingPortalId: undefined as undefined,
    startDate: undefined as undefined,
    endDate: undefined as undefined,
    restrictions: null,
  };

  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)
    );
    prismaMock.promotion.findFirst.mockResolvedValue({ id: "promo-1" });
    prismaMock.promotion.findUnique.mockResolvedValue({ restrictionsId: null });
    prismaMock.promotionBenefit.findMany.mockResolvedValue([]);
    prismaMock.promotionTier.findMany.mockResolvedValue([]);
    prismaMock.promotion.update.mockResolvedValue(mockPromotion);
    prismaMock.promotionRestrictions.create.mockResolvedValue({ id: "new-restr-1" });
  });

  it("throws AppError(404) when promotion not found or not owned", async () => {
    prismaMock.promotion.findFirst.mockResolvedValueOnce(null);

    await expect(updatePromotion("promo-1", "user-1", baseUpdateInput)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("upserts restrictions when existing restrictionsId present", async () => {
    prismaMock.promotion.findUnique.mockResolvedValueOnce({ restrictionsId: "restr-1" });
    const input = {
      ...baseUpdateInput,
      restrictions: {
        minSpend: "50",
        minNightsRequired: "",
        nightsStackable: false,
        spanStays: false,
        maxStayCount: "",
        maxRewardCount: "",
        maxRedemptionValue: "",
        maxTotalBonusPoints: "",
        oncePerSubBrand: false,
        bookByDate: "",
        registrationDeadline: "",
        validDaysAfterRegistration: "",
        registrationDate: "",
        tieInRequiresPayment: false,
        allowedPaymentTypes: [],
        allowedBookingSources: [],
        allowedCountryCodes: [],
        allowedAccommodationTypes: [],
        hotelChainId: "",
        prerequisiteStayCount: "",
        prerequisiteNightCount: "",
        subBrandIncludeIds: [],
        subBrandExcludeIds: [],
        tieInCreditCardIds: [],
      },
    };

    await updatePromotion("promo-1", "user-1", input);

    expect(prismaMock.promotionSubBrandRestriction.deleteMany).toHaveBeenCalledWith({
      where: { promotionRestrictionsId: "restr-1" },
    });
    expect(prismaMock.promotionRestrictionTieInCard.deleteMany).toHaveBeenCalledWith({
      where: { promotionRestrictionsId: "restr-1" },
    });
    expect(prismaMock.promotionRestrictions.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "restr-1" } })
    );
  });

  it("creates new restrictions when no existing restrictionsId", async () => {
    prismaMock.promotion.findUnique.mockResolvedValueOnce({ restrictionsId: null });
    prismaMock.promotionRestrictions.create.mockResolvedValueOnce({ id: "new-restr-1" });
    const input = {
      ...baseUpdateInput,
      restrictions: {
        minSpend: "",
        minNightsRequired: "",
        nightsStackable: false,
        spanStays: false,
        maxStayCount: "",
        maxRewardCount: "",
        maxRedemptionValue: "",
        maxTotalBonusPoints: "",
        oncePerSubBrand: false,
        bookByDate: "",
        registrationDeadline: "",
        validDaysAfterRegistration: "",
        registrationDate: "",
        tieInRequiresPayment: false,
        allowedPaymentTypes: [],
        allowedBookingSources: [],
        allowedCountryCodes: [],
        allowedAccommodationTypes: [],
        hotelChainId: "",
        prerequisiteStayCount: "",
        prerequisiteNightCount: "",
        subBrandIncludeIds: [],
        subBrandExcludeIds: [],
        tieInCreditCardIds: [],
      },
    };

    await updatePromotion("promo-1", "user-1", input);

    expect(prismaMock.promotionRestrictions.create).toHaveBeenCalled();
    const updateCall = prismaMock.promotion.update.mock.calls[0][0];
    expect(updateCall.data.restrictions).toEqual({ connect: { id: "new-restr-1" } });
  });

  it("clears restrictions when restrictions is null and existing restrictionsId exists", async () => {
    prismaMock.promotion.findUnique.mockResolvedValueOnce({ restrictionsId: "restr-1" });
    const input = { ...baseUpdateInput, restrictions: null };

    await updatePromotion("promo-1", "user-1", input as unknown as typeof baseUpdateInput);

    expect(prismaMock.promotionRestrictions.delete).toHaveBeenCalledWith({
      where: { id: "restr-1" },
    });
    const updateCall = prismaMock.promotion.update.mock.calls[0][0];
    expect(updateCall.data.restrictions).toEqual({ disconnect: true });
  });

  it("replaces flat benefits when benefits array provided", async () => {
    prismaMock.promotionBenefit.findMany.mockResolvedValueOnce([
      { id: "b-1", restrictionsId: null },
    ]);
    const input = {
      ...baseUpdateInput,
      benefits: [
        {
          rewardType: "points" as const,
          valueType: "fixed" as const,
          value: 500,
          certType: null,
          sortOrder: 0,
          restrictions: null,
        },
      ],
    };

    await updatePromotion("promo-1", "user-1", input);

    expect(prismaMock.promotionBenefit.deleteMany).toHaveBeenCalledWith({
      where: { promotionId: "promo-1" },
    });
    const updateCall = prismaMock.promotion.update.mock.calls[0][0];
    expect(updateCall.data.benefits).toEqual(
      expect.objectContaining({ create: expect.any(Array) })
    );
  });

  it("replaces tiers when tiers array provided", async () => {
    prismaMock.promotionTier.findMany.mockResolvedValueOnce([{ id: "t-1", benefits: [] }]);
    const input = {
      ...baseUpdateInput,
      tiers: [{ minStays: 2, maxStays: null, minNights: null, maxNights: null, benefits: [] }],
    };

    await updatePromotion("promo-1", "user-1", input);

    expect(prismaMock.promotionTier.deleteMany).toHaveBeenCalledWith({
      where: { promotionId: "promo-1" },
    });
    const updateCall = prismaMock.promotion.update.mock.calls[0][0];
    expect(updateCall.data.tiers).toEqual(expect.objectContaining({ create: expect.any(Array) }));
  });

  it("upserts UserPromotion when registrationDate is provided in restrictions", async () => {
    const input = {
      ...baseUpdateInput,
      restrictions: {
        minSpend: "",
        minNightsRequired: "",
        nightsStackable: false,
        spanStays: false,
        maxStayCount: "",
        maxRewardCount: "",
        maxRedemptionValue: "",
        maxTotalBonusPoints: "",
        oncePerSubBrand: false,
        bookByDate: "",
        registrationDeadline: "",
        validDaysAfterRegistration: "",
        registrationDate: "2026-07-01",
        tieInRequiresPayment: false,
        allowedPaymentTypes: [],
        allowedBookingSources: [],
        allowedCountryCodes: [],
        allowedAccommodationTypes: [],
        hotelChainId: "",
        prerequisiteStayCount: "",
        prerequisiteNightCount: "",
        subBrandIncludeIds: [],
        subBrandExcludeIds: [],
        tieInCreditCardIds: [],
      },
    };

    await updatePromotion("promo-1", "user-1", input);

    expect(prismaMock.userPromotion.upsert).toHaveBeenCalledWith({
      where: { promotionId: "promo-1" },
      update: { registrationDate: new Date("2026-07-01") },
      create: {
        promotionId: "promo-1",
        userId: "user-1",
        registrationDate: new Date("2026-07-01"),
      },
    });
  });

  it("deletes UserPromotion when registrationDate is empty string", async () => {
    const input = {
      ...baseUpdateInput,
      restrictions: {
        minSpend: "",
        minNightsRequired: "",
        nightsStackable: false,
        spanStays: false,
        maxStayCount: "",
        maxRewardCount: "",
        maxRedemptionValue: "",
        maxTotalBonusPoints: "",
        oncePerSubBrand: false,
        bookByDate: "",
        registrationDeadline: "",
        validDaysAfterRegistration: "",
        registrationDate: "",
        tieInRequiresPayment: false,
        allowedPaymentTypes: [],
        allowedBookingSources: [],
        allowedCountryCodes: [],
        allowedAccommodationTypes: [],
        hotelChainId: "",
        prerequisiteStayCount: "",
        prerequisiteNightCount: "",
        subBrandIncludeIds: [],
        subBrandExcludeIds: [],
        tieInCreditCardIds: [],
      },
    };

    await updatePromotion("promo-1", "user-1", input);

    expect(prismaMock.userPromotion.deleteMany).toHaveBeenCalledWith({
      where: { promotionId: "promo-1" },
    });
  });

  it("calls matchPromotionsForAffectedBookings after transaction", async () => {
    await updatePromotion("promo-1", "user-1", baseUpdateInput);

    expect(matchPromotionsForAffectedBookings).toHaveBeenCalledWith("promo-1", "user-1");
  });
});

// ---------------------------------------------------------------------------
// deletePromotion
// ---------------------------------------------------------------------------

describe("deletePromotion", () => {
  beforeEach(() => {
    prismaMock.promotion.findFirst.mockResolvedValue({ id: "promo-1" });
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.promotion.findUnique.mockResolvedValue({
      restrictionsId: null,
      benefits: [],
      tiers: [],
    });
    prismaMock.promotion.delete.mockResolvedValue(undefined);
  });

  it("throws AppError(404) when promotion not found or not owned", async () => {
    prismaMock.promotion.findFirst.mockResolvedValueOnce(null);

    await expect(deletePromotion("promo-1", "user-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("collects restriction IDs from promotion-level, benefit-level, and tier benefit-level", async () => {
    prismaMock.promotion.findUnique.mockResolvedValueOnce({
      restrictionsId: "r-promo",
      benefits: [{ restrictionsId: "r-benefit" }],
      tiers: [{ benefits: [{ restrictionsId: "r-tier-benefit" }] }],
    });

    await deletePromotion("promo-1", "user-1");

    expect(prismaMock.promotionRestrictions.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["r-promo", "r-benefit", "r-tier-benefit"] } },
    });
  });

  it("skips promotionRestrictions.deleteMany when no restriction IDs collected", async () => {
    prismaMock.promotion.findUnique.mockResolvedValueOnce({
      restrictionsId: null,
      benefits: [{ restrictionsId: null }],
      tiers: [],
    });

    await deletePromotion("promo-1", "user-1");

    expect(prismaMock.promotionRestrictions.deleteMany).not.toHaveBeenCalled();
  });

  it("calls reevaluateBookings with affected booking IDs", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([{ id: "b-1" }, { id: "b-2" }]);

    await deletePromotion("promo-1", "user-1");

    expect(reevaluateBookings).toHaveBeenCalledWith(["b-1", "b-2"], "user-1");
  });

  it("does NOT call reevaluateBookings when no affected bookings", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([]);

    await deletePromotion("promo-1", "user-1");

    expect(reevaluateBookings).not.toHaveBeenCalled();
  });

  it("calls promotion.delete with the promotion id", async () => {
    await deletePromotion("promo-1", "user-1");

    expect(prismaMock.promotion.delete).toHaveBeenCalledWith({ where: { id: "promo-1" } });
  });
});
