import pLimit from "p-limit";
import { logger } from "@/lib/logger";
import { harvestMnemonicsFromSitemap } from "@/lib/scrapers/ihg/sitemap-harvest";
import { fetchPropertyProfile } from "@/lib/scrapers/ihg/property-fetcher";
import { parseIhgProfile } from "@/lib/scrapers/ihg/property-parser";
import { type ChainFetchResult, type ParsedProperty } from "./property-ingest-orchestrator";

const DEFAULT_CONCURRENCY = 10;

export interface IngestOptions {
  concurrency?: number;
  limit?: number;
}

export async function ingestIhgProperties(opts: IngestOptions = {}): Promise<ChainFetchResult> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const errors: string[] = [];
  let skippedCount = 0;
  const properties: ParsedProperty[] = [];

  const allMnemonics = await harvestMnemonicsFromSitemap();
  logger.info("ihg_ingest:mnemonics_discovered", { count: allMnemonics.size });

  let mnemonicList = [...allMnemonics];
  if (opts.limit != null) mnemonicList = mnemonicList.slice(0, opts.limit);

  const limit = pLimit(concurrency);
  let processed = 0;

  await Promise.all(
    mnemonicList.map((mnemonic) =>
      limit(async () => {
        try {
          const raw = await fetchPropertyProfile(mnemonic);
          const parsed = parseIhgProfile(raw);
          if (!parsed) {
            skippedCount++;
          } else {
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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${mnemonic}: ${msg}`);
          logger.error("ihg_ingest:fetch_error", err, { mnemonic });
        }

        processed++;
        if (processed % 500 === 0) {
          logger.info("ihg_ingest:progress", {
            processed,
            total: mnemonicList.length,
            fetchedCount: properties.length,
            skippedCount,
            errors: errors.length,
          });
        }
      })
    )
  );

  logger.info("ihg_ingest:done", { fetchedCount: properties.length, skippedCount });

  return { properties, skippedCount, errors };
}
