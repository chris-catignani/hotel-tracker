import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    cardBenefit: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cardBenefitOtaAgency: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/card-benefit-apply", () => ({
  reapplyBenefitForAllUsers: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { reapplyBenefitForAllUsers } from "@/services/card-benefit-apply";
import { listCardBenefits, getCardBenefit } from "./card-benefit.service";

const prismaMock = prisma as unknown as {
  cardBenefit: {
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
  };
  cardBenefitOtaAgency: { deleteMany: Mock; createMany: Mock };
  $transaction: Mock;
};

const mockBenefit = {
  id: "benefit-1",
  creditCardId: "card-1",
  description: "5% cashback",
  value: 5,
  maxValuePerBooking: null,
  period: "ANNUAL" as const,
  hotelChainId: null,
  isActive: true,
  startDate: null,
  endDate: null,
  hotelChain: null,
  otaAgencies: [],
};

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// listCardBenefits
// ---------------------------------------------------------------------------

describe("listCardBenefits", () => {
  it("returns all card benefits ordered by creditCardId and createdAt", async () => {
    prismaMock.cardBenefit.findMany.mockResolvedValueOnce([mockBenefit]);

    const result = await listCardBenefits();

    expect(prismaMock.cardBenefit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ creditCardId: "asc" }, { createdAt: "asc" }],
      })
    );
    expect(result).toEqual([mockBenefit]);
  });
});

// ---------------------------------------------------------------------------
// getCardBenefit
// ---------------------------------------------------------------------------

describe("getCardBenefit", () => {
  it("returns the benefit when found", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce(mockBenefit);

    const result = await getCardBenefit("benefit-1");

    expect(prismaMock.cardBenefit.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "benefit-1" } })
    );
    expect(result).toEqual(mockBenefit);
  });

  it("throws AppError(404) when benefit not found", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce(null);

    await expect(getCardBenefit("missing")).rejects.toMatchObject({ statusCode: 404 });
  });
});
