import prisma from "@/lib/prisma";

export interface ParsedProperty {
  name: string;
  chainPropertyId?: string | null;
  chainUrlPath?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  subBrandName?: string | null;
}

export interface ChainFetchResult {
  properties: ParsedProperty[];
  skippedCount: number;
  errors: string[];
}

export interface WriteResult {
  upsertedCount: number;
  errors: string[];
}

interface WriteOptions {
  conflictKey: "chainPropertyId" | "chainUrlPath";
  batchSize?: number;
  now?: Date;
}

async function ensureSubBrands(hotelChainId: string, properties: ParsedProperty[]): Promise<void> {
  const uniqueNames = [
    ...new Set(properties.map((p) => p.subBrandName).filter((n): n is string => !!n)),
  ];
  await Promise.allSettled(
    uniqueNames.map((name) =>
      prisma.hotelChainSubBrand.upsert({
        where: { hotelChainId_name: { hotelChainId, name } },
        update: {},
        create: { hotelChainId, name },
      })
    )
  );
}

async function insertBatch(
  hotelChainId: string,
  batch: ParsedProperty[],
  now: Date
): Promise<void> {
  await prisma.property.createMany({
    data: batch.map((p) => ({
      name: p.name,
      hotelChainId,
      chainPropertyId: p.chainPropertyId ?? null,
      chainUrlPath: p.chainUrlPath ?? null,
      countryCode: p.countryCode ?? null,
      city: p.city ?? null,
      address: p.address ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      lastSeenAt: now,
    })),
    skipDuplicates: true,
  });
}

async function updateBatch(
  hotelChainId: string,
  batch: ParsedProperty[],
  conflictKey: "chainPropertyId" | "chainUrlPath",
  now: Date
): Promise<void> {
  const names = batch.map((p) => p.name);
  const countryCodes = batch.map((p) => p.countryCode ?? null);
  const cities = batch.map((p) => p.city ?? null);
  const addresses = batch.map((p) => p.address ?? null);
  const latitudes = batch.map((p) => p.latitude ?? null);
  const longitudes = batch.map((p) => p.longitude ?? null);

  if (conflictKey === "chainPropertyId") {
    const ids = batch.map((p) => p.chainPropertyId ?? null);
    const urlPaths = batch.map((p) => p.chainUrlPath ?? null);
    // Parameter order must match unnest column list exactly: $2=ids, $3=names, $4=countryCodes, $5=cities, $6=addresses, $7=latitudes, $8=longitudes, $9=urlPaths
    await prisma.$executeRawUnsafe(
      `UPDATE properties AS p
       SET name            = v.name,
           country_code    = v.country_code,
           city            = v.city,
           address         = v.address,
           latitude        = v.latitude::float8,
           longitude       = v.longitude::float8,
           chain_url_path  = v.chain_url_path,
           last_seen_at    = $10
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::float8[], $8::float8[], $9::text[])
         AS v(chain_property_id, name, country_code, city, address, latitude, longitude, chain_url_path)
       WHERE p.hotel_chain_id = $1
         AND p.chain_property_id = v.chain_property_id`,
      hotelChainId,
      ids,
      names,
      countryCodes,
      cities,
      addresses,
      latitudes,
      longitudes,
      urlPaths,
      now
    );
  } else {
    const urlPaths = batch.map((p) => p.chainUrlPath ?? null);
    const chainPropertyIds = batch.map((p) => p.chainPropertyId ?? null);
    // Parameter order must match unnest column list exactly: $2=urlPaths, $3=names, $4=countryCodes, $5=cities, $6=addresses, $7=latitudes, $8=longitudes, $9=chainPropertyIds
    await prisma.$executeRawUnsafe(
      `UPDATE properties AS p
       SET name              = v.name,
           country_code      = v.country_code,
           city              = v.city,
           address           = v.address,
           latitude          = v.latitude::float8,
           longitude         = v.longitude::float8,
           chain_property_id = v.chain_property_id,
           last_seen_at      = $10
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::float8[], $8::float8[], $9::text[])
         AS v(chain_url_path, name, country_code, city, address, latitude, longitude, chain_property_id)
       WHERE p.hotel_chain_id = $1
         AND p.chain_url_path = v.chain_url_path`,
      hotelChainId,
      urlPaths,
      names,
      countryCodes,
      cities,
      addresses,
      latitudes,
      longitudes,
      chainPropertyIds,
      now
    );
  }
}

export async function writeProperties(
  hotelChainId: string,
  properties: ParsedProperty[],
  opts: WriteOptions
): Promise<WriteResult> {
  const batchSize = opts.batchSize ?? 500;
  const now = opts.now ?? new Date();
  const errors: string[] = [];
  let upsertedCount = 0;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    try {
      await ensureSubBrands(hotelChainId, batch);
      await insertBatch(hotelChainId, batch, now);
      await updateBatch(hotelChainId, batch, opts.conflictKey, now);
      upsertedCount += batch.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`batch[${i}]: ${msg}`);
    }
  }

  return { upsertedCount, errors };
}
