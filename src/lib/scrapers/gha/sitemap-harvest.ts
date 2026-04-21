import { chromium, type Browser } from "playwright";
import { GHA_NON_PROPERTY_SEGMENTS, GHA_COLLECTION_SLUGS_DEPRIO } from "./sub-brand-slugs";

const SITEMAP_URL = "https://www.ghadiscovery.com/sitemap";

export function filterPropertyUrls(paths: string[]): string[] {
  return paths.filter((p) => {
    const segs = p.split("/").filter(Boolean);
    if (segs.length !== 2) return false;
    return !GHA_NON_PROPERTY_SEGMENTS.has(segs[0]);
  });
}

export function dedupCrossListings(paths: string[]): string[] {
  const bySlug = new Map<string, string[]>();
  for (const p of paths) {
    const slug = p.split("/").filter(Boolean)[1];
    if (!slug) continue;
    const arr = bySlug.get(slug) ?? [];
    arr.push(p);
    bySlug.set(slug, arr);
  }
  const kept: string[] = [];
  for (const group of Array.from(bySlug.values())) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const primary = group.find((p) => {
      const first = p.split("/").filter(Boolean)[0];
      return !GHA_COLLECTION_SLUGS_DEPRIO.has(first);
    });
    kept.push(primary ?? group[0]);
  }
  return kept;
}

export async function harvestWithBrowser(browser: Browser): Promise<string[]> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(SITEMAP_URL, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("a[href]", { timeout: 30_000 });
    const hrefs: string[] = await page.$$eval("a[href]", (nodes) =>
      nodes.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
    );
    const paths = hrefs
      .map((h) => {
        try {
          return new URL(h, SITEMAP_URL).pathname;
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    return dedupCrossListings(filterPropertyUrls(paths));
  } finally {
    await context.close();
  }
}

export async function harvestGhaSitemap(): Promise<string[]> {
  const browser = await chromium.launch();
  try {
    return await harvestWithBrowser(browser);
  } finally {
    await browser.close();
  }
}
