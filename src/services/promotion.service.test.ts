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
import { getPromotion, listPromotions } from "./promotion.service";
import { AppError } from "@/lib/app-error";

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

    await expect(getPromotion("promo-1", "user-1")).rejects.toThrow(AppError);
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
