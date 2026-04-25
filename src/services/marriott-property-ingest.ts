import { logger } from "@/lib/logger";
import { fetchAllBrands, type FetchBrandFn } from "@/lib/scrapers/marriott/property-fetcher";
import { parseMarriottBrand } from "@/lib/scrapers/marriott/property-parser";
import { type ChainFetchResult, type ParsedProperty } from "./property-ingest-orchestrator";

interface IngestOptions {
  fetchBrand?: FetchBrandFn;
  sleepMs?: number;
  now?: Date;
  limit?: number;
}

export async function ingestMarriottProperties(
  opts: IngestOptions = {}
): Promise<ChainFetchResult> {
  const { responses, errors: fetchErrors } = await fetchAllBrands(
    opts.fetchBrand,
    opts.fetchBrand,
    opts.sleepMs
  );

  const allProperties: ParsedProperty[] = [];
  let skippedCount = 0;
  const errors: string[] = [...fetchErrors];

  for (const { brandCode, data } of responses) {
    const parsed = parseMarriottBrand(brandCode, data);
    allProperties.push(
      ...parsed.properties.map((p) => ({
        name: p.name,
        chainPropertyId: p.chainPropertyId,
        chainUrlPath: p.chainUrlPath ?? null,
        countryCode: p.countryCode,
        city: p.city,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        subBrandName: p.subBrandName,
      }))
    );
    skippedCount += parsed.skippedCount;
  }

  let properties = allProperties;
  if (opts.limit != null) properties = properties.slice(0, opts.limit);

  logger.info("marriott_ingest:parsed", { total: properties.length, skippedCount });

  return { properties, skippedCount, errors };
}
