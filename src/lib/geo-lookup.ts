import prisma from "@/lib/prisma";
import { GeoResult } from "@/lib/types";
import { ALPHA3_TO_ALPHA2 } from "@/lib/countries";

const HERE_GEOCODE_URL = "https://geocode.search.hereapi.com/v1/geocode";

interface HereItem {
  title: string;
  address: {
    city?: string;
    county?: string;
    countryCode?: string; // ISO 3166-1 alpha-3 e.g. "MYS"
  };
  position: {
    lat: number;
    lng: number;
  };
}

interface HereResponse {
  items: HereItem[];
}

function mapHereItem(item: HereItem): GeoResult {
  const alpha3 = item.address.countryCode ?? "";
  const countryCode = ALPHA3_TO_ALPHA2[alpha3] ?? alpha3.slice(0, 2).toUpperCase();
  const city = item.address.city ?? item.address.county ?? "";
  return {
    displayName: item.title,
    city,
    countryCode,
    latitude: item.position.lat,
    longitude: item.position.lng,
  };
}

export async function searchProperties(query: string): Promise<GeoResult[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 3) return [];

  // Check cache first
  const cached = await prisma.geoCache.findUnique({ where: { queryKey: normalized } });
  if (cached) {
    return cached.results as unknown as GeoResult[];
  }

  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    console.warn("HERE_API_KEY is not set — geo search unavailable");
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    lang: "en",
    limit: "5",
    apiKey,
  });

  const res = await fetch(`${HERE_GEOCODE_URL}?${params}`);
  if (!res.ok) {
    console.error(`HERE API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = (await res.json()) as HereResponse;
  const results: GeoResult[] = data.items.map(mapHereItem);

  // Cache results
  await prisma.geoCache.upsert({
    where: { queryKey: normalized },
    create: {
      queryKey: normalized,
      results: results as unknown as import("@prisma/client").Prisma.JsonArray,
    },
    update: {
      results: results as unknown as import("@prisma/client").Prisma.JsonArray,
      resolvedAt: new Date(),
    },
  });

  return results;
}
