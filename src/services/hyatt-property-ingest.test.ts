import { describe, it, expect } from "vitest";
import { ingestHyattProperties } from "./hyatt-property-ingest";
import type { ChainFetchResult } from "./property-ingest-orchestrator";

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
  it("returns FULLY_BOOKABLE properties and counts NOT_BOOKABLE as skipped", async () => {
    const html = makeStoreHtml([
      { spiritCode: "good1", openStatus: "FULLY_BOOKABLE" },
      { spiritCode: "bad1", openStatus: "NOT_BOOKABLE" },
      { spiritCode: "good2", openStatus: "PRECONSTRUCTION_BOOKABLE" },
    ]);

    const result: ChainFetchResult = await ingestHyattProperties({ fetchHtml: async () => html });

    expect(result.properties).toHaveLength(2);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("returns empty result when HTML has no STORE payload", async () => {
    const result: ChainFetchResult = await ingestHyattProperties({
      fetchHtml: async () => "<html><body>no store</body></html>",
    });
    expect(result.properties).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("respects the limit option", async () => {
    const html = makeStoreHtml([{ spiritCode: "P1" }, { spiritCode: "P2" }, { spiritCode: "P3" }]);

    const result: ChainFetchResult = await ingestHyattProperties({
      fetchHtml: async () => html,
      limit: 2,
    });

    expect(result.properties).toHaveLength(2);
  });

  it("maps all ParsedProperty fields correctly", async () => {
    const html = makeStoreHtml([{ spiritCode: "testh1" }]);

    const result: ChainFetchResult = await ingestHyattProperties({
      fetchHtml: async () => html,
    });

    expect(result.properties[0]).toMatchObject({
      name: "Hotel testh1",
      chainPropertyId: "testh1",
      countryCode: "US",
      city: "City",
      address: "1 Main St",
      latitude: 40.0,
      longitude: -75.0,
      subBrandName: "Hyatt Place",
    });
  });
});
