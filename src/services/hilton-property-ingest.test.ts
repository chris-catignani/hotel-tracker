import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/scrapers/hilton/property-fetcher", () => ({
  fetchHiltonProperties: vi.fn(),
}));

vi.mock("@/lib/scrapers/hilton/property-parser", () => ({
  parseHiltonHotel: vi.fn(),
}));

import { fetchHiltonProperties } from "@/lib/scrapers/hilton/property-fetcher";
import { parseHiltonHotel } from "@/lib/scrapers/hilton/property-parser";
import { ingestHiltonProperties } from "./hilton-property-ingest";
import type { ChainFetchResult } from "./property-ingest-orchestrator";

function makeRawHotel(ctyhocn: string) {
  return { ctyhocn, name: `Hotel ${ctyhocn}`, brandCode: "HI" };
}

function makeParsedProperty(ctyhocn: string) {
  return {
    chainPropertyId: ctyhocn,
    name: `Hotel ${ctyhocn}`,
    chainUrlPath: null,
    subBrandName: "Hilton",
    address: "1 Main St",
    city: "New York",
    countryCode: "US",
    latitude: 40.0,
    longitude: -74.0,
  };
}

describe("ingestHiltonProperties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches hotels, parses each, and returns parsed properties", async () => {
    (fetchHiltonProperties as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRawHotel("NYCMHHH"),
      makeRawHotel("LAXHITW"),
    ]);
    (parseHiltonHotel as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeParsedProperty("NYCMHHH"))
      .mockReturnValueOnce(makeParsedProperty("LAXHITW"));

    const result: ChainFetchResult = await ingestHiltonProperties();

    expect(result.properties).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("counts hotels that fail parsing as skipped", async () => {
    (fetchHiltonProperties as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRawHotel("BADHOTEL"),
    ]);
    (parseHiltonHotel as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const result: ChainFetchResult = await ingestHiltonProperties();

    expect(result.skippedCount).toBe(1);
    expect(result.properties).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("passes limit option through to fetchHiltonProperties", async () => {
    (fetchHiltonProperties as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRawHotel("NYCMHHH"),
    ]);
    (parseHiltonHotel as ReturnType<typeof vi.fn>).mockReturnValue(makeParsedProperty("NYCMHHH"));

    await ingestHiltonProperties({ limit: 5 });

    expect(fetchHiltonProperties).toHaveBeenCalledWith({ limit: 5 });
  });

  it("maps all ParsedProperty fields correctly", async () => {
    (fetchHiltonProperties as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRawHotel("NYCMHHH"),
    ]);
    (parseHiltonHotel as ReturnType<typeof vi.fn>).mockReturnValue(makeParsedProperty("NYCMHHH"));

    const result: ChainFetchResult = await ingestHiltonProperties();

    expect(result.properties[0]).toMatchObject({
      chainPropertyId: "NYCMHHH",
      chainUrlPath: null,
      subBrandName: "Hilton",
      countryCode: "US",
      city: "New York",
    });
  });
});
