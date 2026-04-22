import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { logger } from "@/lib/logger";
import { parseMarriottBrand } from "./property-parser";

const PROPERTY_OK = {
  marsha_code: "NYCRZ",
  name: "The Ritz-Carlton New York",
  brand_code: "RZ",
  country_code: "US",
  city: "New York",
  address: "50 Central Park South",
  latitude: "40.7645",
  longitude: "-73.9765",
  status: "A",
  bookable: true,
};

function wrapInRegions(properties: unknown[]): unknown {
  return {
    regions: [
      {
        region_countries: [
          {
            country_code: "US",
            country_states: [
              {
                state_cities: [{ city: "New York", city_properties: properties }],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("parseMarriottBrand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flattens nested regions/countries/states/cities into a flat property list", () => {
    const data = {
      regions: [
        {
          region_countries: [
            {
              country_code: "US",
              country_states: [
                {
                  state_cities: [
                    { city: "New York", city_properties: [{ ...PROPERTY_OK, marsha_code: "P1" }] },
                    { city: "Boston", city_properties: [{ ...PROPERTY_OK, marsha_code: "P2" }] },
                  ],
                },
              ],
            },
            {
              country_code: "FR",
              country_states: [
                {
                  state_cities: [
                    { city: "Paris", city_properties: [{ ...PROPERTY_OK, marsha_code: "P3" }] },
                  ],
                },
              ],
            },
          ],
        },
        {
          region_countries: [
            {
              country_code: "JP",
              country_states: [
                {
                  state_cities: [
                    { city: "Tokyo", city_properties: [{ ...PROPERTY_OK, marsha_code: "P4" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const { properties } = parseMarriottBrand("RZ", data);
    expect(properties).toHaveLength(4);
    expect(properties.map((p) => p.chainPropertyId)).toEqual(
      expect.arrayContaining(["P1", "P2", "P3", "P4"])
    );
  });

  it("filters out status !== 'A' properties and counts them as skippedCount", () => {
    const data = wrapInRegions([
      { ...PROPERTY_OK, marsha_code: "GOOD1", status: "A" },
      { ...PROPERTY_OK, marsha_code: "BAD1", status: "P" },
      { ...PROPERTY_OK, marsha_code: "GOOD2", status: "A" },
    ]);
    const { properties, skippedCount } = parseMarriottBrand("RZ", data);
    expect(properties).toHaveLength(2);
    expect(properties.map((p) => p.chainPropertyId)).toEqual(
      expect.arrayContaining(["GOOD1", "GOOD2"])
    );
    expect(skippedCount).toBe(1);
  });

  it("filters out bookable: false properties and counts them as skippedCount", () => {
    const data = wrapInRegions([
      { ...PROPERTY_OK, marsha_code: "GOOD", bookable: true },
      { ...PROPERTY_OK, marsha_code: "BAD", bookable: false },
    ]);
    const { properties, skippedCount } = parseMarriottBrand("RZ", data);
    expect(properties).toHaveLength(1);
    expect(properties[0].chainPropertyId).toBe("GOOD");
    expect(skippedCount).toBe(1);
  });

  it("parses latitude and longitude strings to floats", () => {
    const data = wrapInRegions([{ ...PROPERTY_OK, latitude: "40.7645", longitude: "-73.9765" }]);
    const { properties } = parseMarriottBrand("RZ", data);
    expect(properties[0].latitude).toBe(40.7645);
    expect(properties[0].longitude).toBe(-73.9765);
  });

  it("resolves known brand code to full brand name as subBrandName", () => {
    const data = wrapInRegions([PROPERTY_OK]);
    const { properties } = parseMarriottBrand("RZ", data);
    expect(properties[0].subBrandName).toBe("The Ritz-Carlton");
  });

  it("always sets chainUrlPath to null", () => {
    const data = wrapInRegions([PROPERTY_OK]);
    const { properties } = parseMarriottBrand("RZ", data);
    expect(properties[0].chainUrlPath).toBeNull();
  });

  it("skips all properties for unknown brand code and logs a warning", () => {
    const data = wrapInRegions([
      { ...PROPERTY_OK, marsha_code: "P1" },
      { ...PROPERTY_OK, marsha_code: "P2" },
    ]);
    const { properties, skippedCount } = parseMarriottBrand("ZZ", data);
    expect(properties).toHaveLength(0);
    expect(skippedCount).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      "marriott_parse:unknown_brand",
      expect.objectContaining({ brandCode: "ZZ", propertyCount: 2 })
    );
  });

  it("returns empty result for malformed data", () => {
    const { properties, skippedCount } = parseMarriottBrand("RZ", null);
    expect(properties).toHaveLength(0);
    expect(skippedCount).toBe(0);
  });
});
