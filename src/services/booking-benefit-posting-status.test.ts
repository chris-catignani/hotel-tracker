import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    bookingBenefit: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { preserveBenefitPostingStatuses } from "./booking.service";

const prismaMock = prisma as unknown as {
  bookingBenefit: {
    findMany: Mock;
  };
};

describe("preserveBenefitPostingStatuses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps existing postingStatus onto incoming benefits by id", async () => {
    prismaMock.bookingBenefit.findMany.mockResolvedValue([
      { id: "bb-1", postingStatus: "posted" },
      { id: "bb-2", postingStatus: "pending" },
    ]);

    const result = await preserveBenefitPostingStatuses("booking-1", [
      { id: "bb-1", benefitType: "lounge_access", label: null, dollarValue: null },
      { id: "bb-2", benefitType: "free_breakfast", label: null, dollarValue: null },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ id: "bb-1", postingStatus: "posted" }),
      expect.objectContaining({ id: "bb-2", postingStatus: "pending" }),
    ]);
  });

  it("defaults to pending for a new benefit without an id", async () => {
    prismaMock.bookingBenefit.findMany.mockResolvedValue([{ id: "bb-1", postingStatus: "posted" }]);

    const result = await preserveBenefitPostingStatuses("booking-1", [
      { id: "bb-1", benefitType: "lounge_access", label: null, dollarValue: null },
      { benefitType: "free_breakfast", label: null, dollarValue: null },
    ]);

    expect(result[0]).toMatchObject({ id: "bb-1", postingStatus: "posted" });
    expect(result[1]).toMatchObject({ postingStatus: "pending" });
  });

  it("defaults to pending when the incoming id is not found in the DB", async () => {
    prismaMock.bookingBenefit.findMany.mockResolvedValue([]);

    const result = await preserveBenefitPostingStatuses("booking-1", [
      { id: "stale-id", benefitType: "lounge_access", label: null, dollarValue: null },
    ]);

    expect(result[0]).toMatchObject({ id: "stale-id", postingStatus: "pending" });
  });
});
