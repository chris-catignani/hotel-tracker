import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    property: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    hotelChainSubBrand: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ingestHyattProperties } from "./hyatt-property-ingest";

function makeStoreHtml(entries: Array<{ spiritCode: string; openStatus?: string }>): string {
  const properties = entries.map((e) => ({
    spiritCode: e.spiritCode,
    openStatus: e.openStatus ?? "FULLY_BOOKABLE",
    name: `Hotel ${e.spiritCode}`,
    brand: { label: "Hyatt Place" },
    location: {
      addressLine1: "1 Main St",
      city: "City",
      country: { key: "US" },
      geolocation: { latitude: 40.0, longitude: -75.0 },
    },
    url: `https://www.hyatt.com/hyatt-place/en-US/${e.spiritCode}`,
  }));

  return `<html><head><script>window.STORE = ${JSON.stringify({
    properties: {
      "United States & Canada": { "": { "United States": { PA: properties } } },
    },
  })};</script></head></html>`;
}

describe("ingestHyattProperties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts FULLY_BOOKABLE properties and skips NOT_BOOKABLE", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const html = makeStoreHtml([
      { spiritCode: "good1", openStatus: "FULLY_BOOKABLE" },
      { spiritCode: "bad1", openStatus: "NOT_BOOKABLE" },
      { spiritCode: "good2", openStatus: "PRECONSTRUCTION_BOOKABLE" },
    ]);

    const result = await ingestHyattProperties({ fetchHtml: async () => html });

    expect(result.fetchedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.upsertedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(prisma.property.upsert).toHaveBeenCalledTimes(2);
  });

  it("records an error per property that throws during upsert without aborting the batch", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection lost")
    );

    const html = makeStoreHtml([{ spiritCode: "abexa" }]);
    const result = await ingestHyattProperties({ fetchHtml: async () => html });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("abexa");
    expect(result.upsertedCount).toBe(0);
  });

  it("returns empty result when HTML has no STORE payload", async () => {
    const result = await ingestHyattProperties({
      fetchHtml: async () => "<html><body>no store</body></html>",
    });
    expect(result).toEqual({ fetchedCount: 0, upsertedCount: 0, skippedCount: 0, errors: [] });
  });

  it("pre-creates each unique sub-brand once regardless of batch size", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const html = makeStoreHtml([{ spiritCode: "a1" }, { spiritCode: "a2" }, { spiritCode: "a3" }]);

    await ingestHyattProperties({ fetchHtml: async () => html, batchSize: 2 });

    expect(prisma.hotelChainSubBrand.upsert).toHaveBeenCalledTimes(1);
  });

  it("upserts brand-less properties without error", async () => {
    const noBrandHtml = `<html><head><script>window.STORE = ${JSON.stringify({
      properties: {
        "United States & Canada": {
          "": {
            "United States": {
              PA: [
                {
                  spiritCode: "nobrand",
                  openStatus: "FULLY_BOOKABLE",
                  name: "No Brand Hotel",
                  brand: { label: "" },
                  location: {
                    addressLine1: "1 Main St",
                    city: "City",
                    country: { key: "US" },
                    geolocation: { latitude: 40.0, longitude: -75.0 },
                  },
                  url: "https://www.hyatt.com/en-US/nobrand",
                },
              ],
            },
          },
        },
      },
    })};</script></head></html>`;

    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const result = await ingestHyattProperties({ fetchHtml: async () => noBrandHtml });

    expect(result.upsertedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prisma.hotelChainSubBrand.upsert).not.toHaveBeenCalled();
  });

  it("upserts by chainPropertyId key and includes name in update arm", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const html = makeStoreHtml([{ spiritCode: "testh1" }]);
    await ingestHyattProperties({ fetchHtml: async () => html });

    expect(prisma.property.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          hotelChainId_chainPropertyId: expect.objectContaining({ chainPropertyId: "testh1" }),
        },
        update: expect.objectContaining({ name: "Hotel testh1" }),
      })
    );
  });
});
