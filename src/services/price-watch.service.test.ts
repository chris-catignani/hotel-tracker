import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    priceWatch: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
import {
  listPriceWatches,
  getPriceWatch,
  upsertPriceWatch,
  updatePriceWatch,
  deletePriceWatch,
} from "./price-watch.service";

const prismaMock = prisma as unknown as {
  priceWatch: {
    findMany: Mock;
    findFirst: Mock;
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

  it("includes hotel chain name in property query", async () => {
    prismaMock.priceWatch.findMany.mockResolvedValueOnce([]);

    await listPriceWatches("user-1");

    expect(prismaMock.priceWatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          property: expect.objectContaining({
            include: expect.objectContaining({
              hotelChain: expect.anything(),
            }),
          }),
        }),
      })
    );
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

// ---------------------------------------------------------------------------
// upsertPriceWatch
// ---------------------------------------------------------------------------

describe("upsertPriceWatch", () => {
  const baseInput = { propertyId: "prop-1" };

  beforeEach(() => {
    prismaMock.priceWatch.upsert.mockResolvedValue({ id: "watch-1" });
    prismaMock.priceWatch.findFirst.mockResolvedValue(mockWatch);
  });

  it("throws AppError(400) when propertyId is missing", async () => {
    await expect(upsertPriceWatch("user-1", { propertyId: "" })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("upserts watch for (userId, propertyId) and returns full watch", async () => {
    const result = await upsertPriceWatch("user-1", baseInput);

    expect(prismaMock.priceWatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_propertyId: { userId: "user-1", propertyId: "prop-1" } },
        create: expect.objectContaining({ userId: "user-1", propertyId: "prop-1" }),
      })
    );
    expect(prismaMock.priceWatchBooking.upsert).not.toHaveBeenCalled();
    expect(result).toEqual(mockWatch);
  });

  it("links a booking when bookingId is provided", async () => {
    prismaMock.booking.findFirst.mockResolvedValueOnce({ id: "booking-1" });

    await upsertPriceWatch("user-1", {
      ...baseInput,
      bookingId: "booking-1",
      cashThreshold: 200,
      awardThreshold: 15000,
      dateFlexibilityDays: 2,
    });

    expect(prismaMock.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "booking-1", userId: "user-1" } })
    );
    expect(prismaMock.priceWatchBooking.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "booking-1" },
        create: expect.objectContaining({
          priceWatchId: "watch-1",
          cashThreshold: 200,
          awardThreshold: 15000,
          dateFlexibilityDays: 2,
        }),
      })
    );
  });

  it("throws AppError(404) when bookingId not owned by user", async () => {
    prismaMock.booking.findFirst.mockResolvedValueOnce(null);

    await expect(
      upsertPriceWatch("user-1", { ...baseInput, bookingId: "other-booking" })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prismaMock.priceWatchBooking.upsert).not.toHaveBeenCalled();
  });

  it("throws AppError(500) when refetch returns null after upsert", async () => {
    prismaMock.priceWatch.findFirst.mockResolvedValueOnce(null);

    await expect(upsertPriceWatch("user-1", baseInput)).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ---------------------------------------------------------------------------
// updatePriceWatch
// ---------------------------------------------------------------------------

describe("updatePriceWatch", () => {
  it("updates and returns the watch when found", async () => {
    prismaMock.priceWatch.findFirst.mockResolvedValueOnce({ id: "watch-1" });
    prismaMock.priceWatch.update.mockResolvedValueOnce({ ...mockWatch, isEnabled: false });

    const result = await updatePriceWatch("watch-1", "user-1", { isEnabled: false });

    expect(prismaMock.priceWatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "watch-1" },
        data: { isEnabled: false },
      })
    );
    expect(result).toMatchObject({ isEnabled: false });
  });

  it("throws AppError(404) when watch not found", async () => {
    prismaMock.priceWatch.findFirst.mockResolvedValueOnce(null);

    await expect(updatePriceWatch("watch-1", "user-1", { isEnabled: false })).rejects.toMatchObject(
      { statusCode: 404 }
    );

    expect(prismaMock.priceWatch.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deletePriceWatch
// ---------------------------------------------------------------------------

describe("deletePriceWatch", () => {
  it("deletes the watch when found", async () => {
    prismaMock.priceWatch.findFirst.mockResolvedValueOnce({ id: "watch-1" });
    prismaMock.priceWatch.delete.mockResolvedValueOnce({});

    await deletePriceWatch("watch-1", "user-1");

    expect(prismaMock.priceWatch.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "watch-1" } })
    );
  });

  it("throws AppError(404) when watch not found", async () => {
    prismaMock.priceWatch.findFirst.mockResolvedValueOnce(null);

    await expect(deletePriceWatch("watch-1", "user-1")).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prismaMock.priceWatch.delete).not.toHaveBeenCalled();
  });
});
