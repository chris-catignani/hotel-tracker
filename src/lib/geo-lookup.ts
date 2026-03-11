import prisma from "@/lib/prisma";
import { GeoResult } from "@/lib/types";

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

function mapGooglePlace(place: GooglePlace): GeoResult {
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
    placeId: place.id ?? null,
    displayName: place.displayName.text,
    city,
    countryCode,
    address: place.formattedAddress ?? null,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
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
      includedType: "lodging",
    }),
  });

  if (!res.ok) {
    console.error(`Google Places API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = (await res.json()) as GooglePlacesResponse;
  const results: GeoResult[] = (data.places ?? []).map(mapGooglePlace);

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
