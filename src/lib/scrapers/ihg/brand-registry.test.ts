import { describe, it, expect } from "vitest";
import { FALLBACK_BRANDS, extractBrandListingPaths } from "./brand-registry";

describe("FALLBACK_BRANDS", () => {
  it("all entries have a non-empty listingPath starting with /", () => {
    expect(FALLBACK_BRANDS.length).toBeGreaterThan(0);
    for (const brand of FALLBACK_BRANDS) {
      expect(brand.listingPath).toBeTruthy();
      expect(brand.listingPath.startsWith("/")).toBe(true);
    }
  });

  it("contains Garner Hotels", () => {
    const paths = FALLBACK_BRANDS.map((b) => b.listingPath);
    expect(paths).toContain("/garner-hotels/content/us/en/locations");
  });
});

describe("extractBrandListingPaths", () => {
  it("extracts listing paths from valid IHG brand links containing /content/", () => {
    const hrefs = [
      "https://www.ihg.com/intercontinental/content/us/en/hotels-resorts",
      "https://www.ihg.com/holidayinn/content/us/en/locations",
    ];
    const brands = extractBrandListingPaths(hrefs);
    expect(brands).toHaveLength(2);
    expect(brands.map((b) => b.listingPath)).toContain(
      "/intercontinental/content/us/en/hotels-resorts"
    );
  });

  it("extracts listing paths containing /destinations/", () => {
    const hrefs = ["https://www.ihg.com/kimptonhotels/content/us/en/stay/destinations"];
    const brands = extractBrandListingPaths(hrefs);
    expect(brands).toHaveLength(1);
    expect(brands[0].listingPath).toBe("/kimptonhotels/content/us/en/stay/destinations");
  });

  it("extracts listing paths containing /explore-hotels/", () => {
    const hrefs = ["https://www.ihg.com/holidayinnresorts/content/us/en/explore-hotels/main"];
    expect(extractBrandListingPaths(hrefs)).toHaveLength(1);
  });

  it("excludes reservation links", () => {
    const hrefs = ["https://www.ihg.com/garner/hotels/us/en/reservation"];
    expect(extractBrandListingPaths(hrefs)).toHaveLength(0);
  });

  it("excludes non-IHG hostnames", () => {
    const hrefs = ["https://other-site.com/content/page"];
    expect(extractBrandListingPaths(hrefs)).toHaveLength(0);
  });

  it("excludes links with fewer than 2 path segments", () => {
    const hrefs = ["https://www.ihg.com/content"];
    expect(extractBrandListingPaths(hrefs)).toHaveLength(0);
  });

  it("deduplicates identical listing paths", () => {
    const hrefs = [
      "https://www.ihg.com/intercontinental/content/us/en/hotels-resorts",
      "https://www.ihg.com/intercontinental/content/us/en/hotels-resorts",
    ];
    expect(extractBrandListingPaths(hrefs)).toHaveLength(1);
  });
});
