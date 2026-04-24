import { describe, it, expect } from "vitest";
import { parseIhgProfile } from "./property-parser";

function makeRaw(overrides: Record<string, unknown> = {}): unknown {
  return {
    hotelContent: [
      {
        hotelCode: "HERCT",
        brandInfo: { brandName: "InterContinental" },
        profile: {
          gdsName: "InterContinental Crete by IHG",
          latLong: { latitude: "35.3387", longitude: "25.0707" },
          hotelStatus: "OPEN",
        },
        address: {
          isoCountryCode: "GR",
          translatedMainAddress: {
            city: [{ value: "Heraklion" }],
            line1: [{ value: "Giofyrou 53" }],
          },
        },
        ...overrides,
      },
    ],
  };
}

describe("parseIhgProfile", () => {
  it("maps all fields from a valid OPEN response", () => {
    expect(parseIhgProfile(makeRaw())).toEqual({
      chainPropertyId: "HERCT",
      name: "InterContinental Crete",
      subBrandName: "InterContinental",
      address: "Giofyrou 53",
      city: "Heraklion",
      countryCode: "GR",
      latitude: 35.3387,
      longitude: 25.0707,
    });
  });

  it('strips " by IHG" suffix from gdsName (case-insensitive)', () => {
    const result = parseIhgProfile(
      makeRaw({
        profile: {
          gdsName: "Kimpton Hotel by IHG",
          latLong: { latitude: "40.0", longitude: "-74.0" },
          hotelStatus: "OPEN",
        },
      })
    );
    expect(result?.name).toBe("Kimpton Hotel");
  });

  it("returns null when hotelStatus is not OPEN", () => {
    expect(
      parseIhgProfile(
        makeRaw({
          profile: {
            gdsName: "Hotel Name",
            latLong: { latitude: "0", longitude: "0" },
            hotelStatus: "CLOSED",
          },
        })
      )
    ).toBeNull();
  });

  it("returns null when hotelContent is absent", () => {
    expect(parseIhgProfile({})).toBeNull();
  });

  it("returns null when hotelContent[0] is absent", () => {
    expect(parseIhgProfile({ hotelContent: [] })).toBeNull();
  });

  it("returns null when hotelCode is absent", () => {
    expect(parseIhgProfile(makeRaw({ hotelCode: undefined }))).toBeNull();
  });

  it("returns null when hotelCode is empty string", () => {
    expect(parseIhgProfile(makeRaw({ hotelCode: "" }))).toBeNull();
  });

  it("returns null latitude/longitude when latLong fields are absent", () => {
    const result = parseIhgProfile(
      makeRaw({
        profile: { gdsName: "Hotel", latLong: {}, hotelStatus: "OPEN" },
      })
    );
    expect(result?.latitude).toBeNull();
    expect(result?.longitude).toBeNull();
  });

  it("returns null address/city/countryCode when address is absent", () => {
    const result = parseIhgProfile(makeRaw({ address: undefined }));
    expect(result?.address).toBeNull();
    expect(result?.city).toBeNull();
    expect(result?.countryCode).toBeNull();
  });
});
