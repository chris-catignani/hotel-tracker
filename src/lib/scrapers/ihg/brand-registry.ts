import type { Page } from "playwright";

export interface BrandConfig {
  listingPath: string;
}

// Garner Hotels only appears on the brands page with a reservation link (no listing link).
export const FALLBACK_BRANDS: BrandConfig[] = [
  { listingPath: "/garner-hotels/content/us/en/locations" },
];

const BRANDS_PAGE_PATH = "/content/us/en/about/brands";
const IHG_HOST = "www.ihg.com";
const LISTING_KEYWORDS = ["/content/", "/destinations/", "/stay/", "/support/", "/explore-hotels/"];

function isListingHref(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.hostname !== IHG_HOST) return false;
  const path = url.pathname;
  if (path.includes("/hotels/us/en/reservation")) return false;
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  return LISTING_KEYWORDS.some((kw) => path.includes(kw));
}

export function extractBrandListingPaths(hrefs: string[]): BrandConfig[] {
  const seen = new Set<string>();
  const result: BrandConfig[] = [];
  for (const href of hrefs) {
    if (!isListingHref(href)) continue;
    const path = new URL(href).pathname;
    if (!seen.has(path)) {
      seen.add(path);
      result.push({ listingPath: path });
    }
  }
  return result;
}

async function dismissCookieConsent(page: Page): Promise<void> {
  try {
    // IHG shows a OneTrust consent banner on first page load — click Accept if present.
    await page.click("#onetrust-accept-btn-handler", { timeout: 3000 });
  } catch {
    // Banner not shown — normal for subsequent navigations or when already dismissed.
  }
}

export async function discoverBrands(page: Page): Promise<BrandConfig[]> {
  await page.goto(`https://${IHG_HOST}${BRANDS_PAGE_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await dismissCookieConsent(page);

  const hrefs: string[] = await page.$$eval("a[href]", (nodes) =>
    nodes.map((a) => (a as HTMLAnchorElement).href)
  );

  const discovered = extractBrandListingPaths(hrefs);

  // Merge FALLBACK_BRANDS, deduplicating by listingPath.
  const knownPaths = new Set(discovered.map((b) => b.listingPath));
  for (const fb of FALLBACK_BRANDS) {
    if (!knownPaths.has(fb.listingPath)) {
      discovered.push(fb);
    }
  }

  return discovered;
}
