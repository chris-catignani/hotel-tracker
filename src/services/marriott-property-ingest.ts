import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { HOTEL_ID } from "@/lib/constants";
import { fetchAllBrands, type FetchBrandFn } from "@/lib/scrapers/marriott/property-fetcher";
import {
  parseMarriottBrand,
  type MarriottParsedProperty,
} from "@/lib/scrapers/marriott/property-parser";
import { findOrCreateProperty } from "./property-utils";

const DEFAULT_BATCH_SIZE = 50;

export interface IngestResult {
  sweptCount: number;
  activeBrandCount: number;
  fetchedCount: number;
  skippedCount: number;
  upsertedCount: number;
  errors: string[];
}

interface IngestOptions {
  fetchBrand?: FetchBrandFn;
  sleepMs?: number;
  now?: Date;
  batchSize?: number;
  limit?: number;
}

async function ensureSubBrand(hotelChainId: string, name: string): Promise<void> {
  await prisma.hotelChainSubBrand.upsert({
    where: { hotelChainId_name: { hotelChainId, name } },
    update: {},
    create: { hotelChainId, name },
  });
}

async function upsertProperty(prop: MarriottParsedProperty, now: Date): Promise<void> {
  const hotelChainId = HOTEL_ID.MARRIOTT;
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

export async function ingestMarriottProperties(opts: IngestOptions = {}): Promise<IngestResult> {
  const now = opts.now ?? new Date();
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const hotelChainId = HOTEL_ID.MARRIOTT;

  const {
    responses,
    sweptCount,
    errors: fetchErrors,
  } = await fetchAllBrands(opts.fetchBrand, opts.fetchBrand, opts.sleepMs);

  const allProperties: MarriottParsedProperty[] = [];
  let skippedCount = 0;
  const errors: string[] = [...fetchErrors];

  for (const { brandCode, data } of responses) {
    const parsed = parseMarriottBrand(brandCode, data);
    allProperties.push(...parsed.properties);
    skippedCount += parsed.skippedCount;
  }

  let properties = allProperties;
  if (opts.limit != null) properties = properties.slice(0, opts.limit);

  logger.info("marriott_ingest:parsed", {
    activeBrandCount: responses.length,
    total: properties.length,
    skippedCount,
  });

  const uniqueBrandNames = [...new Set(properties.map((p) => p.subBrandName).filter(Boolean))];
  await Promise.allSettled(uniqueBrandNames.map((name) => ensureSubBrand(hotelChainId, name)));

  let upsertedCount = 0;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);

    if (i > 0 && i % 250 === 0) {
      logger.info("marriott_ingest:progress", {
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
        logger.error("marriott_ingest:property_error", r.reason, {
          marshaCode: batch[j].chainPropertyId,
        });
      }
    }
  }

  return {
    sweptCount,
    activeBrandCount: responses.length,
    fetchedCount: properties.length,
    skippedCount,
    upsertedCount,
    errors,
  };
}
