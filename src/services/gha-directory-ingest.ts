import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { HOTEL_ID } from "@/lib/constants";
import { harvestGhaSitemap } from "@/lib/gha/sitemap-harvest";
import { parseGhaPropertyNextData } from "@/lib/gha/next-data-parser";
import { subBrandNameForSlug } from "@/lib/gha/sub-brand-slugs";
import { findOrCreateProperty } from "./property-utils";

export const STALE_AFTER_DAYS = 180;

export function decideUrlsToFetch(
  harvested: string[],
  known: Map<string, Date | null>,
  now: Date
): string[] {
  const cutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 3600_000);
  return harvested.filter((url) => {
    const lastFetched = known.get(url);
    if (lastFetched == null) return true;
    return lastFetched < cutoff;
  });
}

async function ensureSubBrand(hotelChainId: string, slug: string) {
  const name = subBrandNameForSlug(slug);
  return prisma.hotelChainSubBrand.upsert({
    where: { hotelChainId_name: { hotelChainId, name } },
    update: {},
    create: { hotelChainId, name },
  });
}

interface IngestOptions {
  forceFullRefetch?: boolean;
  limit?: number;
  harvest?: () => Promise<string[]>;
  fetchHtml?: (url: string) => Promise<string>;
  now?: Date;
}

export interface IngestResult {
  harvestedCount: number;
  stampedCount: number;
  fetchedCount: number;
  upsertedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function ingestGhaDirectory(opts: IngestOptions = {}): Promise<IngestResult> {
  const harvest = opts.harvest ?? harvestGhaSitemap;
  const fetchHtml =
    opts.fetchHtml ??
    (async (url: string) => {
      const res = await fetch(`https://www.ghadiscovery.com${url}`);
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
      return res.text();
    });
  const now = opts.now ?? new Date();

  const hotelChainId = HOTEL_ID.GHA_DISCOVERY;

  const urls = await harvest();
  logger.info("gha_ingest:harvested", { count: urls.length });

  const known = await prisma.property.findMany({
    where: { hotelChainId, chainUrlPath: { in: urls } },
    select: { chainUrlPath: true, detailLastFetchedAt: true },
  });
  const knownMap = new Map<string, Date | null>();
  for (const row of known) {
    if (row.chainUrlPath) knownMap.set(row.chainUrlPath, row.detailLastFetchedAt);
  }
  await prisma.property.updateMany({
    where: { hotelChainId, chainUrlPath: { in: urls } },
    data: { lastSeenAt: now },
  });

  const decided = opts.forceFullRefetch ? urls : decideUrlsToFetch(urls, knownMap, now);
  const toFetch = opts.limit != null ? decided.slice(0, opts.limit) : decided;
  if (opts.limit != null)
    logger.info("gha_ingest:limit_applied", { limit: opts.limit, decided: decided.length });

  const subBrandCache = new Map<string, string>();
  const errors: string[] = [];
  let fetchedCount = 0;
  let upsertedCount = 0;
  let skippedCount = 0;

  for (const url of toFetch) {
    try {
      const html = await fetchHtml(url);
      fetchedCount++;
      const parsed = parseGhaPropertyNextData(html, url);
      if (!parsed) {
        skippedCount++;
        logger.warn("gha_ingest:skip", { url, reason: "no __NEXT_DATA__ or not a hotel" });
        continue;
      }

      let subBrandId = subBrandCache.get(parsed.subBrandSlug);
      if (!subBrandId) {
        const row = await ensureSubBrand(hotelChainId, parsed.subBrandSlug);
        subBrandId = row.id;
        subBrandCache.set(parsed.subBrandSlug, subBrandId);
      }

      const propertyId = await findOrCreateProperty({
        propertyName: parsed.name,
        hotelChainId,
        countryCode: parsed.countryCode,
        city: parsed.city,
        address: parsed.address,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        chainPropertyId: parsed.chainPropertyId,
        chainUrlPath: parsed.chainUrlPath,
        chainCategories: parsed.chainCategories,
        detailLastFetchedAt: now,
        lastSeenAt: now,
      });

      await prisma.property.update({
        where: { id: propertyId },
        data: {
          countryCode: parsed.countryCode,
          city: parsed.city,
          address: parsed.address,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          chainPropertyId: parsed.chainPropertyId,
          chainUrlPath: parsed.chainUrlPath,
          chainCategories: parsed.chainCategories,
          detailLastFetchedAt: now,
          lastSeenAt: now,
        },
      });

      upsertedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${url}: ${msg}`);
      logger.error("gha_ingest:url_error", err, { url });
    }
  }

  return {
    harvestedCount: urls.length,
    stampedCount: known.length,
    fetchedCount,
    upsertedCount,
    skippedCount,
    errors,
  };
}
