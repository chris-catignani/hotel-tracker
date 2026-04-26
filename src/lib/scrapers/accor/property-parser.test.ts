import { describe, it, expect, vi } from "vitest";
import { parseAccorProperty } from "./property-parser";
import fixture from "./__fixtures__/accor-woosmap-page.json";

const mockLogger = { warn: vi.fn() };

function makeFeature(overrides: Record<string, unknown> = {}): object {
  return {
    type: "Feature",
    properties: {
      store_id: "1234",
      name: "Ibis Paris Gare de Lyon",
      address: {
        lines: ["1 Rue de Lyon, 75012 Paris"],
        country_code: "FR",
        city: null,
      },
      types: ["IBH"],
    },
    geometry: { type: "Point", coordinates: [2.373, 48.844] },
    ...overrides,
  };
}

describe("parseAccorProperty", () => {
  it("maps all fields from a standard feature", () => {
    const result = parseAccorProperty(makeFeature(), mockLogger);
    expect(result).toEqual({
      name: "Ibis Paris Gare de Lyon",
      chainPropertyId: "1234",
      chainUrlPath: null,
      city: null,
      countryCode: "FR",
      address: "1 Rue de Lyon, 75012 Paris",
      latitude: 48.844,
      longitude: 2.373,
      subBrandName: "Ibis",
    });
  });

  it("returns null and skips TST entries", () => {
    const feature = makeFeature({
      properties: {
        store_id: "0339",
        name: "Test Hotel",
        address: { lines: ["Some St"], country_code: "FR", city: null },
        types: ["TST"],
      },
    });
    expect(parseAccorProperty(feature, mockLogger)).toBeNull();
  });

  it("returns null and skips ELA entries (API test hotels)", () => {
    const feature = makeFeature({
      properties: {
        store_id: "ELA1",
        name: "HOTEL DE TEST API D3",
        address: { lines: ["Some St"], country_code: "FR", city: null },
        types: ["ELA"],
      },
    });
    expect(parseAccorProperty(feature, mockLogger)).toBeNull();
  });

  it("uses the first address line; null when lines is empty", () => {
    const feature = makeFeature({
      properties: {
        store_id: "C3M1",
        name: "Novotel KL",
        address: { lines: [], country_code: "MY", city: null },
        types: ["NOV"],
      },
    });
    const result = parseAccorProperty(feature, mockLogger);
    expect(result?.address).toBeNull();
  });

  it("city is always null", () => {
    const result = parseAccorProperty(makeFeature(), mockLogger);
    expect(result?.city).toBeNull();
  });

  it("chainUrlPath is always null", () => {
    const result = parseAccorProperty(makeFeature(), mockLogger);
    expect(result?.chainUrlPath).toBeNull();
  });

  it("geometry.coordinates[1] → latitude, coordinates[0] → longitude", () => {
    const result = parseAccorProperty(makeFeature(), mockLogger);
    expect(result?.latitude).toBe(48.844);
    expect(result?.longitude).toBe(2.373);
  });

  it("maps SAM to 'Other brands'", () => {
    const feature = makeFeature({
      properties: {
        store_id: "9999",
        name: "Unbranded Hotel",
        address: { lines: ["1 Main St"], country_code: "AU", city: null },
        types: ["SAM"],
      },
    });
    const result = parseAccorProperty(feature, mockLogger);
    expect(result).not.toBeNull();
    expect(result?.subBrandName).toBe("Other brands");
  });

  it("warns and returns null subBrandName for unknown brand code", () => {
    mockLogger.warn.mockClear();
    const feature = makeFeature({
      properties: {
        store_id: "8888",
        name: "Mystery Hotel",
        address: { lines: ["Unknown St"], country_code: "US", city: null },
        types: ["XYZ"],
      },
    });
    const result = parseAccorProperty(feature, mockLogger);
    expect(result?.subBrandName).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith("accor_ingest:unknown_brand_code", {
      code: "XYZ",
      storeId: "8888",
      name: "Mystery Hotel",
    });
  });

  it("returns null when store_id is missing", () => {
    const feature = makeFeature({
      properties: {
        name: "No ID Hotel",
        address: { lines: ["1 Main St"], country_code: "US", city: null },
        types: ["IBH"],
      },
    });
    expect(parseAccorProperty(feature, mockLogger)).toBeNull();
  });

  it("parses first feature of fixture correctly (IBH → Ibis)", () => {
    const result = parseAccorProperty(fixture.features[0], mockLogger);
    expect(result).toMatchObject({
      chainPropertyId: "0338",
      name: "ibis Alès Centre-Ville",
      countryCode: "FR",
      subBrandName: "Ibis",
      latitude: 44.123816,
      longitude: 4.082268,
    });
  });

  it("returns null for second fixture feature (TST)", () => {
    expect(parseAccorProperty(fixture.features[1], mockLogger)).toBeNull();
  });

  it("parses third fixture feature with empty address lines (null address)", () => {
    const result = parseAccorProperty(fixture.features[2], mockLogger);
    expect(result?.address).toBeNull();
    expect(result?.subBrandName).toBe("Novotel");
  });
});
