import { logger } from "@/lib/logger";

// Plain fetch is used here instead of Playwright because page.goto() + page.content() returns
// the browser's XML viewer HTML (with escaped tags) rather than raw XML, so sitemap <loc> tags
// are never found. Plain fetch with browser-like headers returns 200 with the raw XML directly.

const IHG_SITEMAP_INDEX = "https://www.ihg.com/bin/sitemapindex.xml";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/xml,application/xml,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

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

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

export async function harvestMnemonicsFromSitemap(): Promise<Set<string>> {
  const indexXml = await fetchXml(IHG_SITEMAP_INDEX);
  const brandSitemapUrls = parseSitemapIndex(indexXml);
  logger.info("ihg_ingest:sitemap_brands_found", { count: brandSitemapUrls.length });

  const mnemonics = new Set<string>();

  const results = await Promise.allSettled(brandSitemapUrls.map((url) => fetchXml(url)));
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      logger.error("ihg_ingest:sitemap_fetch_error", r.reason, { sitemapUrl: brandSitemapUrls[i] });
      continue;
    }
    for (const hotelUrl of parseBrandSitemap(r.value)) {
      const mnemonic = extractMnemonicFromUrl(hotelUrl);
      if (mnemonic) mnemonics.add(mnemonic);
    }
  }

  return mnemonics;
}
