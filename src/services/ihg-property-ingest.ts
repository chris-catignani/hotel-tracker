import { chromium, type Browser } from "playwright";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { HOTEL_ID } from "@/lib/constants";
import { sleep } from "@/lib/retry";
import { harvestMnemonicsFromSitemap } from "@/lib/scrapers/ihg/sitemap-harvest";
import { fetchPropertyProfile } from "@/lib/scrapers/ihg/property-fetcher";
import { parseIhgProfile, type IhgParsedProperty } from "@/lib/scrapers/ihg/property-parser";

const DEFAULT_BATCH_SLEEP_MS = 2000;
const DEFAULT_BATCH_SIZE = 50;

export interface IngestOptions {
  browser?: Browser;
  batchSleepMs?: number;
  batchSize?: number;
  now?: Date;
  limit?: number;
}

export interface IngestResult {
  discoveredCount: number;
  fetchedCount: number;
  skippedCount: number;
  upsertedCount: number;
  errors: string[];
}

async function ensureSubBrand(hotelChainId: string, name: string): Promise<void> {
  await prisma.hotelChainSubBrand.upsert({
    where: { hotelChainId_name: { hotelChainId, name } },
    update: {},
    create: { hotelChainId, name },
  });
}

async function upsertProperty(prop: IhgParsedProperty, now: Date): Promise<void> {
  const hotelChainId = HOTEL_ID.IHG;
  const data = {
    name: prop.name,
    countryCode: prop.countryCode,
    city: prop.city,
    address: prop.address,
    latitude: prop.latitude,
    longitude: prop.longitude,
    chainUrlPath: null,
    lastSeenAt: now,
  };
  try {
    await prisma.property.upsert({
      where: {
        hotelChainId_chainPropertyId: {
          hotelChainId,
          chainPropertyId: prop.chainPropertyId,
        },
      },
      update: data,
      create: { ...data, hotelChainId, chainPropertyId: prop.chainPropertyId },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    const existing = await prisma.property.findFirst({
      where: { name: prop.name, hotelChainId },
    });
    if (!existing) throw err;
    await prisma.property.update({
      where: { id: existing.id },
      data: { ...data, chainPropertyId: prop.chainPropertyId },
    });
  }
}

export async function ingestIhgProperties(opts: IngestOptions = {}): Promise<IngestResult> {
  const batchSleepMs = opts.batchSleepMs ?? DEFAULT_BATCH_SLEEP_MS;
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = opts.now ?? new Date();
  const hotelChainId = HOTEL_ID.IHG;

  const ownBrowser = !opts.browser;
  const browser = opts.browser ?? (await chromium.launch({ headless: false }));

  const errors: string[] = [];
  let fetchedCount = 0;
  let skippedCount = 0;
  let upsertedCount = 0;
  let mnemonicList: string[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Phase 1: harvest mnemonics from IHG sitemap XML
    const allMnemonics = await harvestMnemonicsFromSitemap(page);
    logger.info("ihg_ingest:mnemonics_discovered", { count: allMnemonics.size });

    // Phase 2: Profile API enrichment
    mnemonicList = [...allMnemonics];
    if (opts.limit != null) mnemonicList = mnemonicList.slice(0, opts.limit);

    const parsedProperties: IhgParsedProperty[] = [];

    for (let i = 0; i < mnemonicList.length; i += batchSize) {
      if (i > 0 && batchSleepMs > 0) await sleep(batchSleepMs);

      const batch = mnemonicList.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map((m) => fetchPropertyProfile(page, m)));

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const mnemonic = batch[j];
        if (r.status === "rejected") {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          errors.push(`${mnemonic}: ${msg}`);
          logger.error("ihg_ingest:fetch_error", r.reason, { mnemonic });
          continue;
        }
        const parsed = parseIhgProfile(r.value);
        if (!parsed) {
          skippedCount++;
          continue;
        }
        fetchedCount++;
        parsedProperties.push(parsed);
      }

      if (i > 0 && i % 500 === 0) {
        logger.info("ihg_ingest:progress", {
          processed: i,
          total: mnemonicList.length,
          fetchedCount,
          skippedCount,
          errors: errors.length,
        });
      }
    }

    logger.info("ihg_ingest:enrichment_done", { fetchedCount, skippedCount });

    // Pre-create sub-brand reference rows
    const uniqueSubBrands = [
      ...new Set(parsedProperties.map((p) => p.subBrandName).filter(Boolean)),
    ];
    await Promise.allSettled(uniqueSubBrands.map((name) => ensureSubBrand(hotelChainId, name)));

    // Upsert properties
    for (let i = 0; i < parsedProperties.length; i += batchSize) {
      const batch = parsedProperties.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map((prop) => upsertProperty(prop, now)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled") {
          upsertedCount++;
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          errors.push(`upsert ${batch[j].chainPropertyId}: ${msg}`);
          logger.error("ihg_ingest:upsert_error", r.reason, {
            chainPropertyId: batch[j].chainPropertyId,
          });
        }
      }
    }
  } finally {
    if (ownBrowser) await browser.close();
  }

  return {
    discoveredCount: mnemonicList.length,
    fetchedCount,
    skippedCount,
    upsertedCount,
    errors,
  };
}
