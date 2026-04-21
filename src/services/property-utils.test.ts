import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    property: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { findOrCreateProperty } from "./property-utils";

const BASE_INPUT = {
  propertyName: "Hotel Indigo Auckland",
  hotelChainId: "chain-1",
  placeId: "google-place-id",
  latitude: -36.8436,
  longitude: 174.768,
};

const EXISTING_NO_COORDS = { id: "p1", latitude: null, longitude: null, placeId: null };
const EXISTING_COMPLETE = {
  id: "p1",
  latitude: -36.8436,
  longitude: 174.768,
  placeId: "google-place-id",
};

describe("findOrCreateProperty", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns existing id without update when coords and placeId already present", async () => {
    (prisma.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(EXISTING_COMPLETE);
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const id = await findOrCreateProperty(BASE_INPUT);
    expect(id).toBe("p1");
    expect(prisma.property.update).not.toHaveBeenCalled();
  });

  it("backfills lat/long and placeId when existing property has null coords", async () => {
    (prisma.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(EXISTING_NO_COORDS);
    const id = await findOrCreateProperty(BASE_INPUT);
    expect(id).toBe("p1");
    expect(prisma.property.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { latitude: -36.8436, longitude: 174.768, placeId: "google-place-id" },
    });
  });

  it("finds by name when placeId lookup returns nothing", async () => {
    (prisma.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(EXISTING_NO_COORDS);
    const id = await findOrCreateProperty(BASE_INPUT);
    expect(id).toBe("p1");
    expect(prisma.property.findFirst).toHaveBeenCalled();
  });

  it("does not backfill coords when input provides none, but still backfills placeId", async () => {
    (prisma.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(EXISTING_NO_COORDS);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { latitude: _lat, longitude: _lng, ...inputWithoutCoords } = BASE_INPUT;
    const id = await findOrCreateProperty(inputWithoutCoords);
    expect(id).toBe("p1");
    expect(prisma.property.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { placeId: "google-place-id" },
    });
  });

  it("creates a new property when none exists", async () => {
    (prisma.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p2" });
    const id = await findOrCreateProperty(BASE_INPUT);
    expect(id).toBe("p2");
    expect(prisma.property.create).toHaveBeenCalled();
  });
});
