import { logger } from "@/lib/logger";
import { fetchHiltonProperties } from "@/lib/scrapers/hilton/property-fetcher";
import { parseHiltonHotel } from "@/lib/scrapers/hilton/property-parser";
import { type ChainFetchResult } from "./property-ingest-orchestrator";

export interface IngestOptions {
  limit?: number;
}

export async function ingestHiltonProperties(opts: IngestOptions = {}): Promise<ChainFetchResult> {
  const errors: string[] = [];
  let skippedCount = 0;

  const rawHotels = await fetchHiltonProperties({ limit: opts.limit });
  logger.info("hilton_ingest:hotels_fetched", { count: rawHotels.length });

  const properties = rawHotels
    .map((raw) => {
      const parsed = parseHiltonHotel(raw);
      if (!parsed) {
        skippedCount++;
        return null;
      }
      return parsed;
    })
    .filter((p) => p !== null);

  logger.info("hilton_ingest:done", { fetchedCount: properties.length, skippedCount });
  return { properties, skippedCount, errors };
}
