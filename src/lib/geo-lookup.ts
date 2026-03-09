import prisma from "@/lib/prisma";
import { GeoResult } from "@/lib/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "hotel-tracker/1.0 (personal travel tracking app)";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    hotel?: string;
    amenity?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country_code?: string;
  };
}

function extractCity(address: NominatimResult["address"]): string {
  return address.city ?? address.town ?? address.village ?? address.municipality ?? "";
}

function mapNominatimResult(result: NominatimResult): GeoResult {
  const namePart =
    result.address.hotel ?? result.address.amenity ?? result.display_name.split(",")[0].trim();
  const city = extractCity(result.address);
  const countryCode = (result.address.country_code ?? "").toUpperCase();
  return {
    displayName: namePart,
    city,
    countryCode,
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
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

  // Call Nominatim
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    addressdetails: "1",
    featuretype: "amenity",
  });

  const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as NominatimResult[];
  const results: GeoResult[] = data.map(mapNominatimResult);

  // Cache results (upsert to handle race conditions)
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
