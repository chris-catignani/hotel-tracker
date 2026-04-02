import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    priceWatch: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    booking: {
      findFirst: vi.fn(),
    },
    priceWatchBooking: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { listPriceWatches, getPriceWatch } from "./price-watch.service";

const prismaMock = prisma as unknown as {
  priceWatch: {
    findMany: Mock;
    findFirst: Mock;
    findUnique: Mock;
    upsert: Mock;
    update: Mock;
    delete: Mock;
  };
  booking: { findFirst: Mock };
  priceWatchBooking: { upsert: Mock };
};

const mockWatch = {
  id: "watch-1",
  userId: "user-1",
  propertyId: "prop-1",
  isEnabled: true,
  property: { id: "prop-1", name: "Grand Hyatt" },
  bookings: [],
  snapshots: [],
};

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// listPriceWatches
// ---------------------------------------------------------------------------

describe("listPriceWatches", () => {
  it("queries by userId and returns results", async () => {
    prismaMock.priceWatch.findMany.mockResolvedValueOnce([mockWatch]);

    const result = await listPriceWatches("user-1");

    expect(prismaMock.priceWatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
    expect(result).toEqual([mockWatch]);
  });
});

// ---------------------------------------------------------------------------
// getPriceWatch
// ---------------------------------------------------------------------------

describe("getPriceWatch", () => {
  it("returns the watch when found", async () => {
    prismaMock.priceWatch.findFirst.mockResolvedValueOnce(mockWatch);

    const result = await getPriceWatch("watch-1", "user-1");

    expect(prismaMock.priceWatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "watch-1", userId: "user-1" } })
    );
    expect(result).toEqual(mockWatch);
  });

  it("throws AppError(404) when watch not found", async () => {
    prismaMock.priceWatch.findFirst.mockResolvedValueOnce(null);

    await expect(getPriceWatch("watch-1", "user-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
