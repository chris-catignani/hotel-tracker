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
import { reapplyBenefitForAllUsers } from "@/services/card-benefit-apply";
import {
  listCardBenefits,
  getCardBenefit,
  createCardBenefit,
  updateCardBenefit,
  deleteCardBenefit,
} from "./card-benefit.service";

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

// ---------------------------------------------------------------------------
// createCardBenefit
// ---------------------------------------------------------------------------

describe("createCardBenefit", () => {
  const baseInput = {
    creditCardId: "card-1",
    description: "5% cashback",
    value: 5,
    period: "ANNUAL" as const,
  };

  it("throws AppError(400) when required fields are missing", async () => {
    await expect(
      createCardBenefit({ creditCardId: "", description: "x", value: 5, period: "ANNUAL" as const })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(prismaMock.cardBenefit.create).not.toHaveBeenCalled();
  });

  it("creates benefit without OTA agencies and calls reapplyBenefitForAllUsers", async () => {
    prismaMock.cardBenefit.create.mockResolvedValueOnce(mockBenefit);

    const result = await createCardBenefit(baseInput);

    expect(prismaMock.cardBenefit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creditCardId: "card-1",
          description: "5% cashback",
          value: 5,
          period: "ANNUAL",
          otaAgencies: undefined,
        }),
      })
    );
    expect(reapplyBenefitForAllUsers).toHaveBeenCalledWith("benefit-1");
    expect(result).toEqual(mockBenefit);
  });

  it("creates OTA agency links when otaAgencyIds is provided", async () => {
    prismaMock.cardBenefit.create.mockResolvedValueOnce(mockBenefit);

    await createCardBenefit({ ...baseInput, otaAgencyIds: ["ota-1", "ota-2"] });

    expect(prismaMock.cardBenefit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          otaAgencies: {
            create: [{ otaAgencyId: "ota-1" }, { otaAgencyId: "ota-2" }],
          },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateCardBenefit
// ---------------------------------------------------------------------------

describe("updateCardBenefit", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.cardBenefit.update.mockResolvedValue({ ...mockBenefit, isActive: false });
  });

  it("updates fields and calls reapplyBenefitForAllUsers", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce({ id: "benefit-1" });

    const result = await updateCardBenefit("benefit-1", { isActive: false });

    expect(prismaMock.cardBenefit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "benefit-1" },
        data: { isActive: false },
      })
    );
    expect(reapplyBenefitForAllUsers).toHaveBeenCalledWith("benefit-1");
    expect(result).toMatchObject({ isActive: false });
  });

  it("replaces OTA agencies when otaAgencyIds is provided", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce({ id: "benefit-1" });

    await updateCardBenefit("benefit-1", { otaAgencyIds: ["ota-3"] });

    expect(prismaMock.cardBenefitOtaAgency.deleteMany).toHaveBeenCalledWith({
      where: { cardBenefitId: "benefit-1" },
    });
    expect(prismaMock.cardBenefitOtaAgency.createMany).toHaveBeenCalledWith({
      data: [{ cardBenefitId: "benefit-1", otaAgencyId: "ota-3" }],
    });
  });

  it("skips OTA agency update when otaAgencyIds is not provided", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce({ id: "benefit-1" });

    await updateCardBenefit("benefit-1", { isActive: true });

    expect(prismaMock.cardBenefitOtaAgency.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.cardBenefitOtaAgency.createMany).not.toHaveBeenCalled();
  });

  it("deletes all OTA agencies when otaAgencyIds is empty array", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce({ id: "benefit-1" });

    await updateCardBenefit("benefit-1", { otaAgencyIds: [] });

    expect(prismaMock.cardBenefitOtaAgency.deleteMany).toHaveBeenCalledWith({
      where: { cardBenefitId: "benefit-1" },
    });
    expect(prismaMock.cardBenefitOtaAgency.createMany).not.toHaveBeenCalled();
  });

  it("throws AppError(404) when benefit not found", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce(null);

    await expect(updateCardBenefit("missing", { isActive: false })).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prismaMock.cardBenefit.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteCardBenefit
// ---------------------------------------------------------------------------

describe("deleteCardBenefit", () => {
  it("deletes the benefit by id", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce({ id: "benefit-1" });
    prismaMock.cardBenefit.delete.mockResolvedValueOnce(mockBenefit);

    await deleteCardBenefit("benefit-1");

    expect(prismaMock.cardBenefit.delete).toHaveBeenCalledWith({
      where: { id: "benefit-1" },
    });
  });

  it("throws AppError(404) when benefit not found", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValueOnce(null);

    await expect(deleteCardBenefit("missing")).rejects.toMatchObject({ statusCode: 404 });

    expect(prismaMock.cardBenefit.delete).not.toHaveBeenCalled();
  });
});
