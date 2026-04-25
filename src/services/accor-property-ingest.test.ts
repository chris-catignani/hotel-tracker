import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/scrapers/accor/property-fetcher", () => ({
  fetchAccorProperties: vi.fn(),
}));

vi.mock("@/lib/scrapers/accor/property-parser", () => ({
  parseAccorProperty: vi.fn(),
}));

import { fetchAccorProperties } from "@/lib/scrapers/accor/property-fetcher";
import { parseAccorProperty } from "@/lib/scrapers/accor/property-parser";
import { ingestAccorProperties } from "./accor-property-ingest";
import type { ChainFetchResult } from "./property-ingest-orchestrator";

function makeParsedProperty(storeId: string) {
  return {
    name: `Hotel ${storeId}`,
    chainPropertyId: storeId,
    chainUrlPath: null,
    city: null,
    countryCode: "FR",
    address: "1 Main St",
    latitude: 48.8,
    longitude: 2.3,
    subBrandName: "Ibis",
  };
}

const mockFeature = (storeId: string) => ({ properties: { store_id: storeId } });

describe("ingestAccorProperties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches features, parses them, and returns ChainFetchResult", async () => {
    (fetchAccorProperties as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockFeature("0001"),
      mockFeature("0002"),
    ]);
    (parseAccorProperty as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeParsedProperty("0001"))
      .mockReturnValueOnce(makeParsedProperty("0002"));

    const result: ChainFetchResult = await ingestAccorProperties();

    expect(result.properties).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("counts skipped when parser returns null (e.g. TST entry)", async () => {
    (fetchAccorProperties as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockFeature("0001"),
      mockFeature("TST1"),
    ]);
    (parseAccorProperty as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeParsedProperty("0001"))
      .mockReturnValueOnce(null);

    const result: ChainFetchResult = await ingestAccorProperties();

    expect(result.properties).toHaveLength(1);
    expect(result.skippedCount).toBe(1);
  });

  it("records error when parser throws, does not abort remaining features", async () => {
    (fetchAccorProperties as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockFeature("ERR1"),
      mockFeature("0002"),
    ]);
    (parseAccorProperty as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => {
        throw new Error("parse failed");
      })
      .mockReturnValueOnce(makeParsedProperty("0002"));

    const result: ChainFetchResult = await ingestAccorProperties();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("ERR1");
    expect(result.properties).toHaveLength(1);
  });

  it("passes limit to fetchAccorProperties", async () => {
    (fetchAccorProperties as ReturnType<typeof vi.fn>).mockResolvedValue([mockFeature("0001")]);
    (parseAccorProperty as ReturnType<typeof vi.fn>).mockReturnValue(makeParsedProperty("0001"));

    await ingestAccorProperties({ limit: 10 });

    expect(fetchAccorProperties).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it("maps all ParsedProperty fields correctly", async () => {
    (fetchAccorProperties as ReturnType<typeof vi.fn>).mockResolvedValue([mockFeature("0338")]);
    (parseAccorProperty as ReturnType<typeof vi.fn>).mockReturnValue(makeParsedProperty("0338"));

    const result: ChainFetchResult = await ingestAccorProperties();

    expect(result.properties[0]).toMatchObject({
      name: "Hotel 0338",
      chainPropertyId: "0338",
      chainUrlPath: null,
      subBrandName: "Ibis",
      countryCode: "FR",
      city: null,
    });
  });
});
