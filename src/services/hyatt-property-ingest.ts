import { logger } from "@/lib/logger";
import { parseHyattStore } from "@/lib/scrapers/hyatt/property-parser";
import { fetchExploreHotelsHtml } from "@/lib/scrapers/hyatt/explore-hotels";
import { type ChainFetchResult, type ParsedProperty } from "./property-ingest-orchestrator";

interface IngestOptions {
  fetchHtml?: () => Promise<string>;
  limit?: number;
}

export async function ingestHyattProperties(opts: IngestOptions = {}): Promise<ChainFetchResult> {
  const fetchHtml = opts.fetchHtml ?? fetchExploreHotelsHtml;

  const html = await fetchHtml();
  const parsed = parseHyattStore(html);
  const { skippedCount } = parsed;

  let properties: ParsedProperty[] = parsed.properties.map((p) => ({
    name: p.name,
    chainPropertyId: p.chainPropertyId,
    chainUrlPath: p.chainUrlPath ?? null,
    countryCode: p.countryCode,
    city: p.city,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    subBrandName: p.subBrandName ?? null,
  }));

  if (opts.limit != null) properties = properties.slice(0, opts.limit);

  logger.info("hyatt_ingest:parsed", { total: properties.length, skippedCount });

  return { properties, skippedCount, errors: [] };
}
