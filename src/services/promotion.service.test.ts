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
import { matchPromotionsForAffectedBookings } from "@/services/promotion-apply";
import { getPromotion, listPromotions, createPromotion } from "./promotion.service";

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
