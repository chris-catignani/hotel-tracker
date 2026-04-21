import { describe, it, expect } from "vitest";
import { parseHyattStore } from "./store-parser";

const PROPERTY_OK = {
  spiritCode: "abexa",
  openStatus: "FULLY_BOOKABLE",
  name: "Hyatt House Allentown / Lehigh Valley",
  brand: { key: "HOUSE", label: "Hyatt House" },
  location: {
    addressLine1: "621 Grange Road",
    city: "Allentown",
    country: { key: "US" },
    geolocation: { latitude: 40.56303, longitude: -75.581779 },
  },
  url: "https://www.hyatt.com/hyatt-house/en-US/abexa-hyatt-house-allentown-lehigh-valley",
};

function wrapStore(store: unknown): string {
  return `<html><head><script>window.STORE = ${JSON.stringify(store)};</script></head></html>`;
}

function storeWith(properties: unknown[]): unknown {
  return {
    properties: {
      "United States & Canada": { "": { "United States": { Pennsylvania: properties } } },
    },
  };
}

describe("parseHyattStore", () => {
  it("extracts all canonical fields from a valid STORE", () => {
    const { properties } = parseHyattStore(wrapStore(storeWith([PROPERTY_OK])));
    expect(properties).toHaveLength(1);
    expect(properties[0]).toEqual({
      chainPropertyId: "abexa",
      name: "Hyatt House Allentown / Lehigh Valley",
      subBrandName: "Hyatt House",
      address: "621 Grange Road",
      city: "Allentown",
      countryCode: "US",
      latitude: 40.56303,
      longitude: -75.581779,
      chainUrlPath: "/hyatt-house/en-US/abexa-hyatt-house-allentown-lehigh-valley",
    });
  });

  it("flattens properties across all regions, brands, countries, and states", () => {
    const store = {
      properties: {
        Europe: { "": { France: { "Île-de-France": [{ ...PROPERTY_OK, spiritCode: "parph" }] } } },
        Asia: { "": { Japan: { Tokyo: [{ ...PROPERTY_OK, spiritCode: "tokph" }] } } },
      },
    };
    const { properties } = parseHyattStore(wrapStore(store));
    expect(properties).toHaveLength(2);
    expect(properties.map((p) => p.chainPropertyId)).toEqual(
      expect.arrayContaining(["parph", "tokph"])
    );
  });

  it("filters out NOT_BOOKABLE and counts them as skippedCount", () => {
    const store = storeWith([
      { ...PROPERTY_OK, spiritCode: "good1", openStatus: "FULLY_BOOKABLE" },
      { ...PROPERTY_OK, spiritCode: "bad1", openStatus: "NOT_BOOKABLE" },
      { ...PROPERTY_OK, spiritCode: "good2", openStatus: "PRECONSTRUCTION_BOOKABLE" },
    ]);
    const { properties, skippedCount } = parseHyattStore(wrapStore(store));
    expect(properties).toHaveLength(2);
    expect(properties.map((p) => p.chainPropertyId)).toEqual(
      expect.arrayContaining(["good1", "good2"])
    );
    expect(skippedCount).toBe(1);
  });

  it("returns empty result when window.STORE is missing", () => {
    const result = parseHyattStore("<html><body>no store here</body></html>");
    expect(result).toEqual({ properties: [], skippedCount: 0 });
  });

  it("returns empty result on malformed JSON", () => {
    const result = parseHyattStore("<html><script>window.STORE = {not valid json;</script></html>");
    expect(result).toEqual({ properties: [], skippedCount: 0 });
  });

  it("handles null geolocation gracefully", () => {
    const store = storeWith([
      { ...PROPERTY_OK, location: { ...PROPERTY_OK.location, geolocation: null } },
    ]);
    const { properties } = parseHyattStore(wrapStore(store));
    expect(properties[0].latitude).toBeNull();
    expect(properties[0].longitude).toBeNull();
  });

  it("handles missing url gracefully", () => {
    const store = storeWith([{ ...PROPERTY_OK, url: null }]);
    const { properties } = parseHyattStore(wrapStore(store));
    expect(properties[0].chainUrlPath).toBeNull();
  });
});
