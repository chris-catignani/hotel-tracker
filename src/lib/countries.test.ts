import { describe, it, expect } from "vitest";
import { countryName, ALPHA3_TO_ALPHA2 } from "@/lib/countries";

describe("countryName", () => {
  it("returns the full country name for a known alpha-2 code", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("MY")).toBe("Malaysia");
    expect(countryName("SG")).toBe("Singapore");
    expect(countryName("KR")).toBe("South Korea");
    expect(countryName("GB")).toBe("United Kingdom");
  });

  it("falls back to the raw code for an unknown code", () => {
    expect(countryName("XX")).toBe("XX");
  });
});

describe("ALPHA3_TO_ALPHA2", () => {
  it("maps common hotel destination country codes correctly", () => {
    expect(ALPHA3_TO_ALPHA2["USA"]).toBe("US");
    expect(ALPHA3_TO_ALPHA2["MYS"]).toBe("MY");
    expect(ALPHA3_TO_ALPHA2["SGP"]).toBe("SG");
    expect(ALPHA3_TO_ALPHA2["KOR"]).toBe("KR");
    expect(ALPHA3_TO_ALPHA2["GBR"]).toBe("GB");
    expect(ALPHA3_TO_ALPHA2["JPN"]).toBe("JP");
    expect(ALPHA3_TO_ALPHA2["AUS"]).toBe("AU");
    expect(ALPHA3_TO_ALPHA2["ARE"]).toBe("AE");
    expect(ALPHA3_TO_ALPHA2["THA"]).toBe("TH");
    expect(ALPHA3_TO_ALPHA2["FRA"]).toBe("FR");
  });

  it("returns undefined for an unknown alpha-3 code", () => {
    expect(ALPHA3_TO_ALPHA2["XXX"]).toBeUndefined();
  });
});
