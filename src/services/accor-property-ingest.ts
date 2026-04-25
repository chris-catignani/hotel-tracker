import { logger } from "@/lib/logger";
import { fetchAccorProperties } from "@/lib/scrapers/accor/property-fetcher";
import { parseAccorProperty } from "@/lib/scrapers/accor/property-parser";
import { type ChainFetchResult, type ParsedProperty } from "./property-ingest-orchestrator";

export interface IngestOptions {
  limit?: number;
  fetchPage?: (page: number) => Promise<unknown>;
  requestDelayMs?: number;
}

export async function ingestAccorProperties(opts: IngestOptions = {}): Promise<ChainFetchResult> {
  const rawFeatures = await fetchAccorProperties({
    limit: opts.limit,
    fetchPage: opts.fetchPage,
    requestDelayMs: opts.requestDelayMs,
  });

  logger.info("accor_ingest:fetched", { count: rawFeatures.length });

  const errors: string[] = [];
  let skippedCount = 0;
  const properties: ParsedProperty[] = [];

  for (const [i, feature] of rawFeatures.entries()) {
    if (i > 0 && i % 500 === 0) {
      logger.info("accor_ingest:progress", {
        processed: i,
        total: rawFeatures.length,
        fetchedCount: properties.length,
        skippedCount,
        errors: errors.length,
      });
    }

    try {
      const parsed = parseAccorProperty(feature, logger);
      if (!parsed) {
        skippedCount++;
      } else {
        properties.push(parsed);
      }
    } catch (err) {
      const storeId =
        (feature as { properties?: { store_id?: string } })?.properties?.store_id ?? `index:${i}`;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${storeId}: ${msg}`);
      logger.error("accor_ingest:parse_error", err, { storeId });
    }
  }

  logger.info("accor_ingest:done", { fetchedCount: properties.length, skippedCount });

  return { properties, skippedCount, errors };
}
