import os from "os";
import path from "path";
import { chromium } from "playwright";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { HOTEL_ID } from "@/lib/constants";
import { parseHyattStore, type HyattParsedProperty } from "@/lib/scrapers/hyatt/store-parser";
import { findOrCreateProperty } from "./property-utils";

const FETCH_URL = "https://www.hyatt.com/explore-hotels";

async function fetchWithPlaywright(): Promise<string> {
  // Kasada bot protection requires GPU rendering — headless mode is always blocked.
  // Share the same profile as the price watch scraper so Kasada trusts the session.
  const userDataDir =
    process.env.HYATT_BROWSER_PROFILE_DIR ??
    path.join(os.homedir(), ".cache", "hyatt-browser-profile");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1280, height: 800 },
  });
  let page: Awaited<ReturnType<typeof context.newPage>> | undefined;
  try {
    page = context.pages()[0] ?? (await context.newPage());

    // Log all page console messages (errors, warnings, Kasada challenge output, etc.)
    page.on("console", (msg) => {
      console.log(`[HyattIngest] page:console [${msg.type()}] ${msg.text()}`);
    });

    // Log all failed requests
    page.on("requestfailed", (request) => {
      console.log(
        `[HyattIngest] page:requestfailed ${request.method()} ${request.url()} — ${request.failure()?.errorText}`
      );
    });

    console.log("[HyattIngest] Navigating to homepage...");
    await page.goto("https://www.hyatt.com", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.screenshot({ path: "hyatt-ingest-homepage.png" });
    console.log(`[HyattIngest] Homepage loaded — url=${page.url()}, title=${await page.title()}`);

    // Capture all network activity on the explore-hotels navigation.
    type ResponseEntry = { url: string; status: number; contentType: string; bodyPreview?: string };
    const capturedResponses: ResponseEntry[] = [];
    page.on("response", (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      const entry: ResponseEntry = { url: response.url(), status: response.status(), contentType };
      capturedResponses.push(entry);
      // Eagerly read JSON bodies while the response is still available
      if (contentType.includes("application/json")) {
        response
          .text()
          .then((text) => {
            entry.bodyPreview = text.slice(0, 5000);
          })
          .catch(() => {});
      }
    });

    console.log("[HyattIngest] Navigating to explore-hotels...");
    await page.goto(FETCH_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Wait briefly for any post-DOMContentLoaded scripts to settle
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "hyatt-ingest-explore.png" });

    const finalUrl = page.url();
    const title = await page.title();
    console.log(`[HyattIngest] explore-hotels loaded — url=${finalUrl}, title=${title}`);

    // Log full response list: every URL + status
    console.log(`[HyattIngest] Total responses captured: ${capturedResponses.length}`);
    for (const r of capturedResponses) {
      console.log(`[HyattIngest] response: ${r.status} ${r.contentType.split(";")[0]} ${r.url}`);
    }

    // Log redirect chain
    const redirects = capturedResponses.filter((r) => r.status >= 300 && r.status < 400);
    console.log(`[HyattIngest] Redirects (${redirects.length}):`, JSON.stringify(redirects));

    // Log blocked requests
    const blocked = capturedResponses.filter((r) => r.status === 403 || r.status === 429);
    console.log(`[HyattIngest] Blocked 403/429 (${blocked.length}):`, JSON.stringify(blocked));

    // Log JSON API responses with body previews — these are candidates to intercept
    const jsonResponses = capturedResponses.filter((r) =>
      r.contentType.includes("application/json")
    );
    console.log(`[HyattIngest] JSON responses (${jsonResponses.length}):`);
    for (const r of jsonResponses) {
      console.log(`  ${r.status} ${r.url}`);
      if (r.bodyPreview) console.log(`  body preview: ${r.bodyPreview.slice(0, 1000)}`);
    }

    // Log page HTML source preview
    const pageSource = await page.content();
    console.log(`[HyattIngest] Page source length: ${pageSource.length}`);
    console.log(`[HyattIngest] Page source preview:\n${pageSource.slice(0, 3000)}`);

    const storeJson = await page.evaluate(() =>
      JSON.stringify((window as { STORE?: unknown }).STORE)
    );
    console.log(`[HyattIngest] window.STORE present: ${storeJson !== "null" && !!storeJson}`);
    if (!storeJson || storeJson === "null") {
      throw new Error(
        `window.STORE not populated after page load — url=${finalUrl}, title=${title}`
      );
    }
    return `<script>window.STORE = ${storeJson};</script>`;
  } catch (err) {
    try {
      if (page) await page.screenshot({ path: "hyatt-ingest-failure.png", fullPage: true });
    } catch {
      // ignore screenshot errors
    }
    throw err;
  } finally {
    await context.close();
  }
}
const DEFAULT_BATCH_SIZE = 50;

export interface IngestResult {
  fetchedCount: number;
  upsertedCount: number;
  skippedCount: number;
  errors: string[];
}

interface IngestOptions {
  fetchHtml?: () => Promise<string>;
  now?: Date;
  batchSize?: number;
}

async function ensureSubBrand(hotelChainId: string, name: string): Promise<string> {
  const row = await prisma.hotelChainSubBrand.upsert({
    where: { hotelChainId_name: { hotelChainId, name } },
    update: {},
    create: { hotelChainId, name },
  });
  return row.id;
}

async function upsertProperty(prop: HyattParsedProperty, now: Date): Promise<void> {
  const hotelChainId = HOTEL_ID.HYATT;
  const propertyId = await findOrCreateProperty({
    propertyName: prop.name,
    hotelChainId,
    countryCode: prop.countryCode,
    city: prop.city,
    address: prop.address,
    latitude: prop.latitude,
    longitude: prop.longitude,
    chainPropertyId: prop.chainPropertyId,
    chainUrlPath: prop.chainUrlPath,
    lastSeenAt: now,
  });

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      countryCode: prop.countryCode,
      city: prop.city,
      address: prop.address,
      latitude: prop.latitude,
      longitude: prop.longitude,
      chainPropertyId: prop.chainPropertyId,
      chainUrlPath: prop.chainUrlPath,
      lastSeenAt: now,
    },
  });
}

export async function ingestHyattDirectory(opts: IngestOptions = {}): Promise<IngestResult> {
  const fetchHtml = opts.fetchHtml ?? fetchWithPlaywright;
  const now = opts.now ?? new Date();
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const hotelChainId = HOTEL_ID.HYATT;

  const html = await fetchHtml();
  const { properties, skippedCount } = parseHyattStore(html);

  logger.info("hyatt_ingest:parsed", { total: properties.length, skippedCount });

  // Pre-create sub-brand reference rows so they exist for booking ingestion.
  // Property has no hotelChainSubBrandId column — sub-brand association happens at booking time.
  const uniqueBrandNames = [...new Set(properties.map((p) => p.subBrandName).filter(Boolean))];
  for (const name of uniqueBrandNames) {
    await ensureSubBrand(hotelChainId, name);
  }

  const errors: string[] = [];
  let upsertedCount = 0;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);

    if (i > 0 && i % 250 === 0) {
      logger.info("hyatt_ingest:progress", {
        processed: i,
        total: properties.length,
        upsertedCount,
        errors: errors.length,
      });
    }

    const results = await Promise.allSettled(
      batch.map(async (prop) => {
        await upsertProperty(prop, now);
      })
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        upsertedCount++;
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`${batch[j].chainPropertyId}: ${msg}`);
        logger.error("hyatt_ingest:property_error", r.reason, {
          spiritCode: batch[j].chainPropertyId,
        });
      }
    }
  }

  return { fetchedCount: properties.length, upsertedCount, skippedCount, errors };
}
