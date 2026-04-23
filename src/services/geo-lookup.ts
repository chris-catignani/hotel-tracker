import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { LocalPropertyResult, PlacesResult } from "@/lib/types";

const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

// Only request the fields we need — keeps us in the Basic tier (cheapest)
const FIELD_MASK =
  "places.id,places.displayName,places.addressComponents,places.formattedAddress,places.location";

interface GoogleAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface GooglePlace {
  id: string;
  displayName: { text: string };
  addressComponents: GoogleAddressComponent[];
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

function extractComponent(
  components: GoogleAddressComponent[],
  types: string[]
): GoogleAddressComponent | undefined {
  for (const type of types) {
    const match = components.find((c) => c.types?.includes(type));
    if (match) return match;
  }
}

function mapGooglePlace(place: GooglePlace): PlacesResult {
  const components = place.addressComponents ?? [];
  const city =
    extractComponent(components, [
      "locality",
      "postal_town",
      "administrative_area_level_2",
      "administrative_area_level_1",
    ])?.longText ?? "";
  const countryCode = extractComponent(components, ["country"])?.shortText ?? ""; // already ISO alpha-2

  return {
    source: "places",
    placeId: place.id ?? null,
    displayName: place.displayName.text,
    city,
    countryCode,
    address: place.formattedAddress ?? null,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  };
}

export async function searchPlaces(query: string, isHotel = true): Promise<PlacesResult[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 3) return [];

  // Include accommodation type in cache key so hotel vs apartment searches cache separately
  const cacheKey = isHotel ? normalized : `${normalized}|apt`;

  // Check cache first
  const cached = await prisma.geoCache.findUnique({ where: { queryKey: cacheKey } });
  if (cached) {
    return cached.results as unknown as PlacesResult[];
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY is not set — geo search unavailable");
    return [];
  }

  const res = await fetch(GOOGLE_PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "en",
      maxResultCount: 5,
      ...(isHotel && { includedType: "lodging" }),
    }),
  });

  if (!res.ok) {
    const message = `Google Places API error: ${res.status} ${res.statusText}`;
    logger.error(message, null, { query, status: res.status, statusText: res.statusText });
    return [];
  }

  const data = (await res.json()) as GooglePlacesResponse;
  const results: PlacesResult[] = (data.places ?? []).map(mapGooglePlace);

  // Cache results
  await prisma.geoCache.upsert({
    where: { queryKey: cacheKey },
    create: {
      queryKey: cacheKey,
      results: results as unknown as import("@prisma/client").Prisma.JsonArray,
    },
    update: {
      results: results as unknown as import("@prisma/client").Prisma.JsonArray,
      resolvedAt: new Date(),
    },
  });

  return results;
}

interface PropertyRow {
  id: string;
  name: string;
  hotel_chain_id: string;
  city: string | null;
  country_code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function searchLocalProperties(
  query: string,
  hotelChainId?: string
): Promise<LocalPropertyResult[]> {
  const normalized = query.trim();
  if (normalized.length < 3) return [];

  const chainFilter = hotelChainId
    ? Prisma.sql`AND hotel_chain_id = ${hotelChainId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<PropertyRow[]>`
    SELECT id, name, hotel_chain_id, city, country_code, address, latitude, longitude
    FROM properties
    WHERE hotel_chain_id IS NOT NULL
      ${chainFilter}
      AND word_similarity(${normalized}, name) > 0.2
    ORDER BY word_similarity(${normalized}, name) DESC
    LIMIT 8
  `;

  return rows.map((row) => ({
    source: "local" as const,
    propertyId: row.id,
    hotelChainId: row.hotel_chain_id,
    displayName: row.name,
    city: row.city ?? "",
    countryCode: row.country_code ?? "",
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
  }));
}
