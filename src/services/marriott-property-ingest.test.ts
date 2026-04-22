import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    property: {
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    hotelChainSubBrand: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ingestMarriottProperties } from "./marriott-property-ingest";

type FetchBrand = (code: string) => Promise<unknown | null>;

function makeBrandData(
  properties: Array<{
    marsha_code: string;
    status?: string;
    bookable?: boolean;
    brand_code?: string;
  }>
): unknown {
  return {
    regions: [
      {
        region_countries: [
          {
            country_code: "US",
            country_states: [
              {
                state_cities: [
                  {
                    city: "City",
                    city_properties: properties.map((p) => ({
                      marsha_code: p.marsha_code,
                      name: `Hotel ${p.marsha_code}`,
                      brand_code: p.brand_code ?? "RZ",
                      country_code: "US",
                      city: "City",
                      address: "1 Main St",
                      latitude: "40.0",
                      longitude: "-75.0",
                      status: p.status ?? "A",
                      bookable: p.bookable ?? true,
                    })),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeFetchBrand(brandData: Record<string, unknown>): FetchBrand {
  return async (code: string) => brandData[code] ?? null;
}

describe("ingestMarriottProperties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts active/bookable properties and skips filtered ones", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([
        { marsha_code: "GOOD1", status: "A", bookable: true },
        { marsha_code: "BAD1", status: "P", bookable: true },
        { marsha_code: "BAD2", status: "A", bookable: false },
      ]),
    });

    const result = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.fetchedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
    expect(result.upsertedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prisma.property.update).toHaveBeenCalledTimes(1);
  });

  it("pre-creates each unique sub-brand exactly once regardless of property count", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    // 3 RZ properties — sub-brand upsert should fire exactly once
    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([{ marsha_code: "P1" }, { marsha_code: "P2" }, { marsha_code: "P3" }]),
    });

    await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(prisma.hotelChainSubBrand.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.hotelChainSubBrand.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: "The Ritz-Carlton" }),
      })
    );
  });

  it("records per-property upsert errors without aborting the run", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection lost")
    );

    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([{ marsha_code: "FAILS" }]),
    });

    const result = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("FAILS");
    expect(result.upsertedCount).toBe(0);
  });

  it("respects the limit option — slices total property list before upserting", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([
        { marsha_code: "P1" },
        { marsha_code: "P2" },
        { marsha_code: "P3" },
        { marsha_code: "P4" },
        { marsha_code: "P5" },
      ]),
    });

    const result = await ingestMarriottProperties({ fetchBrand, sleepMs: 0, limit: 2 });

    expect(result.fetchedCount).toBe(2);
    expect(result.upsertedCount).toBe(2);
    expect(prisma.property.update).toHaveBeenCalledTimes(2);
  });

  it("returns correct counts in IngestResult", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    // RZ: 1 active+bookable, 1 pre-opening (status P) → skipped
    // MC: 1 active+bookable
    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([
        { marsha_code: "P1", status: "A", bookable: true },
        { marsha_code: "P2", status: "P", bookable: true },
      ]),
      MC: makeBrandData([{ marsha_code: "P3" }]),
    });

    const result = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.sweptCount).toBe(33);
    expect(result.activeBrandCount).toBe(2);
    expect(result.fetchedCount).toBe(2); // 1 (RZ) + 1 (MC), after status filter
    expect(result.skippedCount).toBe(1); // the P-status one from RZ
    expect(result.upsertedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("includes fetch-level errors from fetchAllBrands in result errors", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    // This fetchBrand throws for "RZ" — fetchAllBrands will add that to its errors[]
    const fetchBrand = async (code: string): Promise<unknown | null> => {
      if (code === "RZ") throw new Error("HTTP 503");
      return null;
    };

    const result = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.includes("RZ") && e.includes("HTTP 503"))).toBe(true);
    expect(result.upsertedCount).toBe(0);
  });

  it("processes all properties across multiple batches when batchSize is small", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.property.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([
        { marsha_code: "P1" },
        { marsha_code: "P2" },
        { marsha_code: "P3" },
        { marsha_code: "P4" },
        { marsha_code: "P5" },
      ]),
    });

    // batchSize: 2 forces 3 batches for 5 properties
    const result = await ingestMarriottProperties({ fetchBrand, sleepMs: 0, batchSize: 2 });

    expect(result.upsertedCount).toBe(5);
    expect(prisma.property.update).toHaveBeenCalledTimes(5);
    expect(result.errors).toHaveLength(0);
  });
});
