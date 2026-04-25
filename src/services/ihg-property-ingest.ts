import { chromium, type Browser } from "playwright";
import { logger } from "@/lib/logger";
import { sleep } from "@/lib/retry";
import { harvestMnemonicsFromSitemap } from "@/lib/scrapers/ihg/sitemap-harvest";
import { fetchPropertyProfile } from "@/lib/scrapers/ihg/property-fetcher";
import { parseIhgProfile } from "@/lib/scrapers/ihg/property-parser";
import { type ChainFetchResult, type ParsedProperty } from "./property-ingest-orchestrator";

const DEFAULT_BATCH_SLEEP_MS = 2000;
const DEFAULT_BATCH_SIZE = 50;

export interface IngestOptions {
  browser?: Browser;
  batchSleepMs?: number;
  batchSize?: number;
  limit?: number;
}

export async function ingestIhgProperties(opts: IngestOptions = {}): Promise<ChainFetchResult> {
  const batchSleepMs = opts.batchSleepMs ?? DEFAULT_BATCH_SLEEP_MS;
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  const ownBrowser = !opts.browser;
  const browser = opts.browser ?? (await chromium.launch({ headless: true }));

  const errors: string[] = [];
  let skippedCount = 0;
  const properties: ParsedProperty[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const allMnemonics = await harvestMnemonicsFromSitemap(page);
    logger.info("ihg_ingest:mnemonics_discovered", { count: allMnemonics.size });

    let mnemonicList = [...allMnemonics];
    if (opts.limit != null) mnemonicList = mnemonicList.slice(0, opts.limit);

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
        properties.push({
          name: parsed.name,
          chainPropertyId: parsed.chainPropertyId,
          chainUrlPath: null,
          countryCode: parsed.countryCode,
          city: parsed.city,
          address: parsed.address,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          subBrandName: parsed.subBrandName,
        });
      }

      if (i > 0 && i % 500 === 0) {
        logger.info("ihg_ingest:progress", {
          processed: i,
          total: mnemonicList.length,
          fetchedCount: properties.length,
          skippedCount,
          errors: errors.length,
        });
      }
    }

    logger.info("ihg_ingest:done", { fetchedCount: properties.length, skippedCount });
  } finally {
    if (ownBrowser) await browser.close();
  }

  return { properties, skippedCount, errors };
}
