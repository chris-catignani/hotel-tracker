import { sleep } from "@/lib/retry";
import { logger } from "@/lib/logger";
import type { Page } from "playwright";
import type { BrandConfig } from "./brand-registry";

const IHG_BASE = "https://www.ihg.com";

type PagePattern = "direct" | "standard-geo" | "brand-destinations";

export function parseMnemonic(href: string, brandSlug: string): string | null {
  const cleanHref = href.includes("?") ? href.substring(0, href.indexOf("?")) : href;

  let pathname: string;
  try {
    pathname = new URL(cleanHref).pathname;
  } catch {
    return null;
  }

  const parts = pathname.split("/");
  // Expected: ["", brandSlug, "hotels", "us", "en", city, mnemonic, "hoteldetail"]
  if (parts.length < 8) return null;
  if (parts[1] !== brandSlug) return null;
  if (parts[7] !== "hoteldetail") return null;

  const mnemonic = parts[6];
  if (!mnemonic) return null;

  return mnemonic.toUpperCase();
}

export function detectPattern(hrefs: string[], brandSlug: string): PagePattern {
  if (hrefs.some((h) => h.includes("?filter=brand"))) return "standard-geo";

  const hasBrandDestinations = hrefs.some((h) => {
    try {
      const url = new URL(h);
      return (
        url.hostname === "www.ihg.com" && url.pathname.startsWith(`/${brandSlug}/destinations/`)
      );
    } catch {
      return false;
    }
  });
  if (hasBrandDestinations) return "brand-destinations";

  return "direct";
}

export function extractSubPageUrls(
  hrefs: string[],
  pattern: "standard-geo" | "brand-destinations",
  brandSlug: string
): string[] {
  if (pattern === "standard-geo") {
    return hrefs.filter((h) => h.includes("?filter=brand"));
  }
  // brand-destinations
  return hrefs.filter((h) => {
    try {
      const url = new URL(h);
      return (
        url.hostname === "www.ihg.com" && url.pathname.startsWith(`/${brandSlug}/destinations/`)
      );
    } catch {
      return false;
    }
  });
}

export function extractMnemonicsFromHrefs(hrefs: string[], brandSlug: string): string[] {
  const seen = new Set<string>();
  for (const href of hrefs) {
    const mnemonic = parseMnemonic(href, brandSlug);
    if (mnemonic) seen.add(mnemonic);
  }
  return [...seen];
}

async function getPageHrefs(page: Page): Promise<string[]> {
  return page.$$eval("a[href]", (nodes) => nodes.map((a) => (a as HTMLAnchorElement).href));
}

export async function harvestMnemonics(
  page: Page,
  brand: BrandConfig,
  opts: { pageSleepMs: number }
): Promise<Set<string>> {
  const brandSlug = brand.listingPath.split("/").filter(Boolean)[0];
  const mnemonics = new Set<string>();

  await page.goto(`${IHG_BASE}${brand.listingPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  const hrefs = await getPageHrefs(page);
  const pattern = detectPattern(hrefs, brandSlug);

  if (pattern === "direct") {
    for (const m of extractMnemonicsFromHrefs(hrefs, brandSlug)) {
      mnemonics.add(m);
    }
    return mnemonics;
  }

  // Geo-drill (either variant): collect sub-page URLs, visit each.
  const subPageUrls = extractSubPageUrls(hrefs, pattern, brandSlug);

  for (const url of subPageUrls) {
    await sleep(opts.pageSleepMs);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const subHrefs = await getPageHrefs(page);
      for (const m of extractMnemonicsFromHrefs(subHrefs, brandSlug)) {
        mnemonics.add(m);
      }
    } catch (err) {
      logger.error("ihg_ingest:sub_page_error", err, { url, brandSlug });
    }
  }

  return mnemonics;
}
