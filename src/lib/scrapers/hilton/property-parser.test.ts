import { describe, it, expect, vi } from "vitest";
import { logger } from "@/lib/logger";
import { parseHiltonHotel } from "./property-parser";

function makeRaw(overrides: Record<string, unknown> = {}): unknown {
  return {
    ctyhocn: "NYCMHHH",
    name: "New York Hilton Midtown",
    brandCode: "HI",
    address: {
      addressLine1: "1335 Avenue of the Americas",
      city: "New York",
      country: "US",
      state: "NY",
    },
    localization: {
      coordinate: { latitude: 40.7629, longitude: -73.9797 },
    },
    ...overrides,
  };
}

describe("parseHiltonHotel", () => {
  it("maps all fields from a valid hotel", () => {
    expect(parseHiltonHotel(makeRaw())).toEqual({
      chainPropertyId: "NYCMHHH",
      name: "New York Hilton Midtown",
      chainUrlPath: null,
      subBrandName: "Hilton",
      address: "1335 Avenue of the Americas",
      city: "New York",
      countryCode: "US",
      latitude: 40.7629,
      longitude: -73.9797,
    });
  });

  it("uppercases ctyhocn", () => {
    const result = parseHiltonHotel(makeRaw({ ctyhocn: "nycmhhh" }));
    expect(result?.chainPropertyId).toBe("NYCMHHH");
  });

  it("maps a known brand code to the display name", () => {
    expect(parseHiltonHotel(makeRaw({ brandCode: "WA" }))?.subBrandName).toBe("Waldorf Astoria");
    expect(parseHiltonHotel(makeRaw({ brandCode: "HP" }))?.subBrandName).toBe("Hampton");
    expect(parseHiltonHotel(makeRaw({ brandCode: "DT" }))?.subBrandName).toBe("DoubleTree");
  });

  it("uses raw brandCode as subBrandName and logs a warning when code is not in the map", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(parseHiltonHotel(makeRaw({ brandCode: "ZZ" }))?.subBrandName).toBe("ZZ");
    expect(warn).toHaveBeenCalledWith(
      "hilton_parse:unknown_brand_code",
      expect.objectContaining({ brandCode: "ZZ" })
    );
    warn.mockRestore();
  });

  it("uses null subBrandName when brandCode is absent", () => {
    expect(parseHiltonHotel(makeRaw({ brandCode: undefined }))?.subBrandName).toBeNull();
  });

  it("returns null when ctyhocn is absent", () => {
    expect(parseHiltonHotel(makeRaw({ ctyhocn: undefined }))).toBeNull();
  });

  it("returns null when ctyhocn is empty string", () => {
    expect(parseHiltonHotel(makeRaw({ ctyhocn: "" }))).toBeNull();
  });

  it("returns null when name is absent", () => {
    expect(parseHiltonHotel(makeRaw({ name: undefined }))).toBeNull();
  });

  it("returns null when name is empty string", () => {
    expect(parseHiltonHotel(makeRaw({ name: "" }))).toBeNull();
  });

  it("returns null address/city/countryCode when address is absent", () => {
    const result = parseHiltonHotel(makeRaw({ address: undefined }));
    expect(result?.address).toBeNull();
    expect(result?.city).toBeNull();
    expect(result?.countryCode).toBeNull();
  });

  it("returns null latitude/longitude when localization is absent", () => {
    const result = parseHiltonHotel(makeRaw({ localization: undefined }));
    expect(result?.latitude).toBeNull();
    expect(result?.longitude).toBeNull();
  });

  it("returns null for missing nested coordinate fields", () => {
    const result = parseHiltonHotel(makeRaw({ localization: { coordinate: {} } }));
    expect(result?.latitude).toBeNull();
    expect(result?.longitude).toBeNull();
  });
});
