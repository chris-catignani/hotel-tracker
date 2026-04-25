import { describe, it, expect } from "vitest";
import { ingestMarriottProperties } from "./marriott-property-ingest";
import type { ChainFetchResult } from "./property-ingest-orchestrator";
import type { FetchBrandFn } from "@/lib/scrapers/marriott/property-fetcher";

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

function makeFetchBrand(brandData: Record<string, unknown>): FetchBrandFn {
  return async (code: string) => brandData[code] ?? null;
}

describe("ingestMarriottProperties", () => {
  it("returns active/bookable properties and counts skipped ones", async () => {
    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([
        { marsha_code: "GOOD1", status: "A", bookable: true },
        { marsha_code: "BAD1", status: "P", bookable: true },
        { marsha_code: "BAD2", status: "A", bookable: false },
      ]),
    });

    const result: ChainFetchResult = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].chainPropertyId).toBe("GOOD1");
    expect(result.skippedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("returns correct subBrandName on each property", async () => {
    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([{ marsha_code: "P1" }]),
    });

    const result: ChainFetchResult = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.properties[0].subBrandName).toBe("The Ritz-Carlton");
  });

  it("includes fetch-level errors in result errors", async () => {
    const fetchBrand = async (code: string): Promise<unknown | null> => {
      if (code === "RZ") throw new Error("HTTP 503");
      return null;
    };

    const result: ChainFetchResult = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.errors.some((e) => e.includes("RZ") && e.includes("HTTP 503"))).toBe(true);
  });

  it("respects the limit option", async () => {
    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([{ marsha_code: "P1" }, { marsha_code: "P2" }, { marsha_code: "P3" }]),
    });

    const result: ChainFetchResult = await ingestMarriottProperties({
      fetchBrand,
      sleepMs: 0,
      limit: 2,
    });

    expect(result.properties).toHaveLength(2);
  });

  it("maps all ParsedProperty fields correctly", async () => {
    const fetchBrand = makeFetchBrand({
      RZ: makeBrandData([{ marsha_code: "TESTM" }]),
    });

    const result: ChainFetchResult = await ingestMarriottProperties({ fetchBrand, sleepMs: 0 });

    expect(result.properties[0]).toMatchObject({
      name: "Hotel TESTM",
      chainPropertyId: "TESTM",
      chainUrlPath: null,
      countryCode: "US",
      city: "City",
      address: "1 Main St",
      latitude: 40.0,
      longitude: -75.0,
    });
  });
});
