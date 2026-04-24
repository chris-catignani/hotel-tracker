import { logger } from "@/lib/logger";
import type { Page } from "playwright";

const IHG_SITEMAP_INDEX = "https://www.ihg.com/bin/sitemapindex.xml";

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

export function parseSitemapIndex(xml: string): string[] {
  return extractLocs(xml).filter((u) => u.includes(".en-us.hoteldetail."));
}

export function parseBrandSitemap(xml: string): string[] {
  return extractLocs(xml);
}

export function extractMnemonicFromUrl(url: string): string | null {
  const clean = url.includes("?") ? url.slice(0, url.indexOf("?")) : url;
  const parts = new URL(clean).pathname.split("/");
  // Expected: ["", brandSlug, "hotels", "us", "en", city, mnemonic, "hoteldetail"]
  if (parts.length < 8 || parts[7] !== "hoteldetail") return null;
  const mnemonic = parts[6];
  return mnemonic ? mnemonic.toUpperCase() : null;
}

async function fetchXml(page: Page, url: string): Promise<string> {
  return page.evaluate(async (u: string) => {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${u}`);
    return res.text();
  }, url);
}

export async function harvestMnemonicsFromSitemap(page: Page): Promise<Set<string>> {
  // Navigate once to establish IHG browser context/cookies.
  await page.goto(IHG_SITEMAP_INDEX, { waitUntil: "domcontentloaded", timeout: 60_000 });

  const indexXml = await page.content();
  const brandSitemapUrls = parseSitemapIndex(indexXml);
  logger.info("ihg_ingest:sitemap_brands_found", { count: brandSitemapUrls.length });

  const mnemonics = new Set<string>();

  for (const sitemapUrl of brandSitemapUrls) {
    try {
      const xml = await fetchXml(page, sitemapUrl);
      const hotelUrls = parseBrandSitemap(xml);
      for (const hotelUrl of hotelUrls) {
        const mnemonic = extractMnemonicFromUrl(hotelUrl);
        if (mnemonic) mnemonics.add(mnemonic);
      }
    } catch (err) {
      logger.error("ihg_ingest:sitemap_fetch_error", err, { sitemapUrl });
    }
  }

  return mnemonics;
}
