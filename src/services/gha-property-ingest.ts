import { logger } from "@/lib/logger";
import { harvestGhaSitemap } from "@/lib/scrapers/gha/sitemap-harvest";
import { parseGhaPropertyNextData } from "@/lib/scrapers/gha/next-data-parser";
import { subBrandNameForSlug } from "@/lib/scrapers/gha/sub-brand-slugs";
import { withRetry, sleep } from "@/lib/retry";
import { type ChainFetchResult, type ParsedProperty } from "./property-ingest-orchestrator";

interface IngestOptions {
  limit?: number;
  harvest?: () => Promise<string[]>;
  fetchHtml?: (url: string) => Promise<string | null>;
  requestDelayMs?: number;
}

export async function ingestGhaProperties(opts: IngestOptions = {}): Promise<ChainFetchResult> {
  const harvest = opts.harvest ?? harvestGhaSitemap;
  const fetchHtml =
    opts.fetchHtml ??
    ((url: string) =>
      withRetry(
        async () => {
          const res = await fetch(`https://www.ghadiscovery.com${url}`);
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
          return res.text();
        },
        url,
        3,
        2000
      ));
  const requestDelayMs = opts.requestDelayMs ?? 300;

  const urls = await harvest();
  const toFetch = opts.limit != null ? urls.slice(0, opts.limit) : urls;
  logger.info("gha_ingest:harvested", { count: urls.length });

  const errors: string[] = [];
  let skippedCount = 0;
  const properties: ParsedProperty[] = [];

  for (const [i, url] of toFetch.entries()) {
    if (i > 0 && i % 50 === 0) {
      logger.info("gha_ingest:progress", {
        processed: i,
        total: toFetch.length,
        fetchedCount: properties.length,
        skippedCount,
        errors: errors.length,
      });
    }
    if (i > 0 && requestDelayMs > 0) await sleep(requestDelayMs);

    try {
      const html = await fetchHtml(url);
      if (html === null) {
        skippedCount++;
        continue;
      }
      const parsed = parseGhaPropertyNextData(html, url);
      if (!parsed) {
        skippedCount++;
        continue;
      }
      if (parsed.unknownCountryName) {
        logger.warn("gha_ingest:unknown_country", { url, countryName: parsed.unknownCountryName });
      }
      properties.push({
        name: parsed.name,
        chainPropertyId: parsed.chainPropertyId,
        chainUrlPath: parsed.chainUrlPath,
        countryCode: parsed.countryCode,
        city: parsed.city,
        address: parsed.address,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        subBrandName: subBrandNameForSlug(parsed.subBrandSlug),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${url}: ${msg}`);
      logger.error("gha_ingest:url_error", err, { url });
    }
  }

  return { properties, skippedCount, errors };
}
