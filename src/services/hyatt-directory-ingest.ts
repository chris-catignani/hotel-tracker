import { chromium } from "playwright";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { HOTEL_ID } from "@/lib/constants";
import { parseHyattStore, type HyattParsedProperty } from "@/lib/scrapers/hyatt/store-parser";
import { findOrCreateProperty } from "./property-utils";

const FETCH_URL = "https://www.hyatt.com/explore-hotels";

async function fetchWithPlaywright(): Promise<string> {
  // Kasada bot protection requires GPU rendering — headless mode is always blocked.
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled", "--window-position=-10000,-10000"],
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(FETCH_URL, { waitUntil: "networkidle", timeout: 60_000 });
    const storeJson = await page.evaluate(() =>
      JSON.stringify((window as { STORE?: unknown }).STORE)
    );
    return `<script>window.STORE = ${storeJson};</script>`;
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
