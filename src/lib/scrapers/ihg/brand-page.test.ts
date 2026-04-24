import { describe, it, expect } from "vitest";
import {
  parseMnemonic,
  detectPattern,
  extractSubPageUrls,
  extractMnemonicsFromHrefs,
} from "./brand-page";

describe("parseMnemonic", () => {
  it("extracts and uppercases mnemonic from a clean hoteldetail href", () => {
    expect(
      parseMnemonic(
        "https://www.ihg.com/holiday-inn-the-niu/hotels/us/en/essen/essce/hoteldetail",
        "holiday-inn-the-niu"
      )
    ).toBe("ESSCE");
  });

  it("strips query string before extracting mnemonic", () => {
    expect(
      parseMnemonic(
        "https://www.ihg.com/intercontinental/hotels/us/en/crete/herct/hoteldetail?scmisc=nav_hotel_p",
        "intercontinental"
      )
    ).toBe("HERCT");
  });

  it("returns null when brand slug (index 1) does not match", () => {
    expect(
      parseMnemonic(
        "https://www.ihg.com/holidayinn/hotels/us/en/city/abcde/hoteldetail",
        "intercontinental"
      )
    ).toBeNull();
  });

  it("returns null for hotel-reviews links (index 7 is hotel-reviews, not hoteldetail)", () => {
    expect(
      parseMnemonic(
        "https://www.ihg.com/intercontinental/hotels/us/en/athens/athha/hotel-reviews",
        "intercontinental"
      )
    ).toBeNull();
  });

  it("returns null for non-hoteldetail links", () => {
    expect(
      parseMnemonic(
        "https://www.ihg.com/intercontinental/content/us/en/hotels-resorts",
        "intercontinental"
      )
    ).toBeNull();
  });

  it("returns null when path is too short", () => {
    expect(
      parseMnemonic("https://www.ihg.com/intercontinental/hotels", "intercontinental")
    ).toBeNull();
  });
});

describe("detectPattern", () => {
  it("returns standard-geo when ?filter=brand links are present", () => {
    const hrefs = [
      "https://www.ihg.com/alabama-united-states?filter=brandholidayinn",
      "https://www.ihg.com/holidayinn/hotels/us/en/city/abcde/hoteldetail",
    ];
    expect(detectPattern(hrefs, "holidayinn")).toBe("standard-geo");
  });

  it("returns brand-destinations when /{brandSlug}/destinations/ links are present", () => {
    const hrefs = ["https://www.ihg.com/holidayinnexpress/destinations/us/en/southeast"];
    expect(detectPattern(hrefs, "holidayinnexpress")).toBe("brand-destinations");
  });

  it("returns direct when no geo links are found", () => {
    const hrefs = [
      "https://www.ihg.com/intercontinental/hotels/us/en/london/loncr/hoteldetail",
      "https://www.ihg.com/intercontinental/content/us/en/hotels-resorts",
    ];
    expect(detectPattern(hrefs, "intercontinental")).toBe("direct");
  });

  it("prefers standard-geo over brand-destinations when both are present", () => {
    const hrefs = [
      "https://www.ihg.com/holidayinnexpress/destinations/us/en/southeast",
      "https://www.ihg.com/alabama?filter=brandsomething",
    ];
    expect(detectPattern(hrefs, "holidayinnexpress")).toBe("standard-geo");
  });

  it("brand-destinations pattern requires the brand slug to match", () => {
    const hrefs = ["https://www.ihg.com/holidayinn/destinations/us/en/southeast"];
    // brandSlug is "holidayinnexpress", link slug is "holidayinn" → not a match
    expect(detectPattern(hrefs, "holidayinnexpress")).toBe("direct");
  });
});

describe("extractSubPageUrls", () => {
  it("extracts ?filter=brand URLs for standard-geo pattern", () => {
    const hrefs = [
      "https://www.ihg.com/alabama-united-states?filter=brandholidayinn",
      "https://www.ihg.com/texas-united-states?filter=brandholidayinn",
      "https://www.ihg.com/holidayinn/hotels/us/en/city/abcde/hoteldetail",
    ];
    const urls = extractSubPageUrls(hrefs, "standard-geo", "holidayinn");
    expect(urls).toHaveLength(2);
    expect(urls).toContain("https://www.ihg.com/alabama-united-states?filter=brandholidayinn");
    expect(urls).toContain("https://www.ihg.com/texas-united-states?filter=brandholidayinn");
  });

  it("extracts /{brandSlug}/destinations/ URLs for brand-destinations pattern", () => {
    const hrefs = [
      "https://www.ihg.com/holidayinnexpress/destinations/us/en/southeast",
      "https://www.ihg.com/holidayinnexpress/destinations/us/en/midwest",
      "https://www.ihg.com/other/content/page",
    ];
    const urls = extractSubPageUrls(hrefs, "brand-destinations", "holidayinnexpress");
    expect(urls).toHaveLength(2);
    expect(urls).toContain("https://www.ihg.com/holidayinnexpress/destinations/us/en/southeast");
  });
});

describe("extractMnemonicsFromHrefs", () => {
  it("returns mnemonics from matching hoteldetail links", () => {
    const hrefs = [
      "https://www.ihg.com/intercontinental/hotels/us/en/london/loncr/hoteldetail",
      "https://www.ihg.com/intercontinental/hotels/us/en/paris/parhb/hoteldetail",
    ];
    const result = extractMnemonicsFromHrefs(hrefs, "intercontinental");
    expect(result.sort()).toEqual(["LONCR", "PARHB"].sort());
  });

  it("deduplicates mnemonics appearing multiple times", () => {
    const hrefs = [
      "https://www.ihg.com/intercontinental/hotels/us/en/london/loncr/hoteldetail",
      "https://www.ihg.com/intercontinental/hotels/us/en/london/loncr/hoteldetail?scmisc=1",
    ];
    expect(extractMnemonicsFromHrefs(hrefs, "intercontinental")).toHaveLength(1);
    expect(extractMnemonicsFromHrefs(hrefs, "intercontinental")).toContain("LONCR");
  });

  it("filters out links with mismatched brand slug", () => {
    const hrefs = ["https://www.ihg.com/holidayinn/hotels/us/en/city/abcde/hoteldetail"];
    expect(extractMnemonicsFromHrefs(hrefs, "intercontinental")).toHaveLength(0);
  });

  it("filters out hotel-reviews links", () => {
    const hrefs = ["https://www.ihg.com/intercontinental/hotels/us/en/london/loncr/hotel-reviews"];
    expect(extractMnemonicsFromHrefs(hrefs, "intercontinental")).toHaveLength(0);
  });

  it("returns empty array when no hoteldetail links are present", () => {
    const hrefs = ["https://www.ihg.com/intercontinental/content/us/en/hotels-resorts"];
    expect(extractMnemonicsFromHrefs(hrefs, "intercontinental")).toHaveLength(0);
  });
});
