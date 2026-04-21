import { describe, it, expect } from "vitest";
import { countryNameToCode } from "./country-name-to-code";

describe("countryNameToCode", () => {
  it("maps common GHA country names to ISO-2", () => {
    expect(countryNameToCode("Italy")).toBe("IT");
    expect(countryNameToCode("United Arab Emirates")).toBe("AE");
    expect(countryNameToCode("United Kingdom")).toBe("GB");
    expect(countryNameToCode("United States")).toBe("US");
    expect(countryNameToCode("Czech Republic")).toBe("CZ");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(countryNameToCode("  italy ")).toBe("IT");
  });

  it("returns null for unknown names", () => {
    expect(countryNameToCode("Atlantis")).toBeNull();
  });
});
