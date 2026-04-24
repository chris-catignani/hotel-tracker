import { describe, it, expect } from "vitest";
import { parseSitemapIndex, parseBrandSitemap, extractMnemonicFromUrl } from "./sitemap-harvest";

const SITEMAP_INDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.ihg.com/bin/sitemap.intercontinental.en-us.hoteldetail.xml</loc></sitemap>
  <sitemap><loc>https://www.ihg.com/bin/sitemap.intercontinental.zh-cn.hoteldetail.xml</loc></sitemap>
  <sitemap><loc>https://www.ihg.com/bin/sitemap.holidayinn.en-us.hoteldetail.xml</loc></sitemap>
  <sitemap><loc>https://www.ihg.com/bin/sitemap.holidayinn.de-de.hoteldetail.xml</loc></sitemap>
  <sitemap><loc>https://www.ihg.com/bin/sitemap.garner-hotels.en-us.hoteldetail.xml</loc></sitemap>
</sitemapindex>`;

const BRAND_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.ihg.com/intercontinental/hotels/us/en/nha-trang/nhach/hoteldetail</loc></url>
  <url><loc>https://www.ihg.com/intercontinental/hotels/us/en/san-diego/sanhb/hoteldetail</loc></url>
  <url><loc>https://www.ihg.com/intercontinental/hotels/us/en/london/loncr/hoteldetail</loc></url>
</urlset>`;

describe("parseSitemapIndex", () => {
  it("returns only en-us hoteldetail sitemap URLs", () => {
    const urls = parseSitemapIndex(SITEMAP_INDEX_XML);
    expect(urls).toHaveLength(3);
    expect(urls).toContain(
      "https://www.ihg.com/bin/sitemap.intercontinental.en-us.hoteldetail.xml"
    );
    expect(urls).toContain("https://www.ihg.com/bin/sitemap.holidayinn.en-us.hoteldetail.xml");
    expect(urls).toContain("https://www.ihg.com/bin/sitemap.garner-hotels.en-us.hoteldetail.xml");
  });

  it("excludes non-en-us locales", () => {
    const urls = parseSitemapIndex(SITEMAP_INDEX_XML);
    expect(urls.every((u) => u.includes(".en-us."))).toBe(true);
  });

  it("returns empty array for empty XML", () => {
    expect(
      parseSitemapIndex(
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>'
      )
    ).toHaveLength(0);
  });
});

describe("parseBrandSitemap", () => {
  it("returns all hotel URLs from a brand sitemap", () => {
    const urls = parseBrandSitemap(BRAND_SITEMAP_XML);
    expect(urls).toHaveLength(3);
    expect(urls).toContain(
      "https://www.ihg.com/intercontinental/hotels/us/en/nha-trang/nhach/hoteldetail"
    );
  });

  it("returns empty array for empty urlset", () => {
    expect(
      parseBrandSitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>')
    ).toHaveLength(0);
  });
});

describe("extractMnemonicFromUrl", () => {
  it("extracts and uppercases mnemonic from hoteldetail URL", () => {
    expect(
      extractMnemonicFromUrl(
        "https://www.ihg.com/intercontinental/hotels/us/en/nha-trang/nhach/hoteldetail"
      )
    ).toBe("NHACH");
  });

  it("handles URLs with query strings", () => {
    expect(
      extractMnemonicFromUrl(
        "https://www.ihg.com/intercontinental/hotels/us/en/san-diego/sanhb/hoteldetail?foo=bar"
      )
    ).toBe("SANHB");
  });

  it("returns null for URLs without hoteldetail segment", () => {
    expect(
      extractMnemonicFromUrl("https://www.ihg.com/intercontinental/content/us/en/hotels-resorts")
    ).toBeNull();
  });

  it("returns null for paths too short", () => {
    expect(extractMnemonicFromUrl("https://www.ihg.com/intercontinental/hotels")).toBeNull();
  });
});
