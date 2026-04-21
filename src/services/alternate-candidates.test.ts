import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    booking: { findFirst: vi.fn() },
    property: { findMany: vi.fn() },
    priceWatchBooking: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { findAlternateCandidates } from "./alternate-candidates";

const anchorBooking = {
  id: "b1",
  userId: "u1",
  propertyId: "p0",
  property: {
    id: "p0",
    latitude: 40.0,
    longitude: -70.0,
    countryCode: "US",
  },
};

describe("findAlternateCandidates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (prisma.priceWatchBooking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("404s if the booking is not owned by userId", async () => {
    (prisma.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      findAlternateCandidates("u1", "missing", { hotelChainIds: ["c1"], radiusMiles: 10 })
    ).rejects.toThrow("Booking not found");
  });

  it("excludes the booking's own property and sorts by distance ascending", async () => {
    (prisma.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(anchorBooking);
    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p0", name: "Anchor", latitude: 40.0, longitude: -70.0, countryCode: "US" },
      { id: "p1", name: "Near", latitude: 40.01, longitude: -70.0, countryCode: "US" },
      { id: "p2", name: "Far", latitude: 40.05, longitude: -70.0, countryCode: "US" },
    ]);
    const out = await findAlternateCandidates("u1", "b1", {
      hotelChainIds: ["c1"],
      radiusMiles: 10,
    });
    expect(out.map((c) => c.propertyId)).toEqual(["p1", "p2"]);
    expect(out[0].distanceMiles).toBeLessThan(out[1].distanceMiles!);
  });

  it("drops properties beyond radius", async () => {
    (prisma.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(anchorBooking);
    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", name: "Within", latitude: 40.01, longitude: -70.0, countryCode: "US" },
      { id: "p2", name: "Outside", latitude: 41.0, longitude: -70.0, countryCode: "US" },
    ]);
    const out = await findAlternateCandidates("u1", "b1", {
      hotelChainIds: ["c1"],
      radiusMiles: 5,
    });
    expect(out.map((c) => c.propertyId)).toEqual(["p1"]);
  });

  it("includes properties with null coords (same country) with distanceMiles=null", async () => {
    (prisma.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(anchorBooking);
    // DB already filters by countryCode; mock returns only same-country results
    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", name: "Near", latitude: 40.01, longitude: -70.0, countryCode: "US" },
      { id: "p2", name: "NoCoords", latitude: null, longitude: null, countryCode: "US" },
    ]);
    const out = await findAlternateCandidates("u1", "b1", {
      hotelChainIds: ["c1"],
      radiusMiles: 10,
    });
    // p1 (distance 0.69mi), then p2 (null distance, no radius filter applied)
    expect(out.map((c) => c.propertyId)).toEqual(["p1", "p2"]);
    expect(out[1].distanceMiles).toBeNull();
  });

  it("includes staleness filter in the geo where clause when coordinates are present", async () => {
    (prisma.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(anchorBooking);
    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await findAlternateCandidates("u1", "b1", {
      hotelChainIds: ["c1"],
      radiusMiles: 10,
    });

    const whereArg = (prisma.property.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    // When geo path is taken, staleness is expressed as AND[0].OR
    // containing lastSeenAt constraints (not silently dropped by spread overwrite).
    const andClause: { OR?: unknown }[] = whereArg.AND;
    expect(Array.isArray(andClause)).toBe(true);
    const staleCondition = andClause[0].OR as { lastSeenAt?: unknown }[];
    expect(Array.isArray(staleCondition)).toBe(true);
    expect(staleCondition.some((c) => "lastSeenAt" in c)).toBe(true);
  });

  it("marks isWatched and populates thresholds for already-watched properties", async () => {
    (prisma.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(anchorBooking);
    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", name: "Watched", latitude: 40.01, longitude: -70.0, countryCode: "US" },
      { id: "p2", name: "Unwatched", latitude: 40.02, longitude: -70.0, countryCode: "US" },
    ]);
    (prisma.priceWatchBooking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        cashThreshold: "200.00",
        awardThreshold: 30000,
        priceWatch: { id: "pw1", propertyId: "p1" },
      },
    ]);
    const out = await findAlternateCandidates("u1", "b1", { hotelChainIds: [], radiusMiles: 10 });
    const watched = out.find((c) => c.propertyId === "p1")!;
    expect(watched.isWatched).toBe(true);
    expect(watched.priceWatchId).toBe("pw1");
    expect(watched.cashThreshold).toBe(200);
    expect(watched.awardThreshold).toBe(30000);
    const unwatched = out.find((c) => c.propertyId === "p2")!;
    expect(unwatched.isWatched).toBe(false);
    expect(unwatched.priceWatchId).toBeNull();
  });

  it("caps results at 50", async () => {
    (prisma.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(anchorBooking);
    const many = Array.from({ length: 80 }).map((_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      latitude: 40 + i * 0.001,
      longitude: -70,
      countryCode: "US",
    }));
    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(many);
    const out = await findAlternateCandidates("u1", "b1", {
      hotelChainIds: ["c1"],
      radiusMiles: 50,
    });
    expect(out.length).toBe(50);
  });
});
