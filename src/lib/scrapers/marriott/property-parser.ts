import { logger } from "@/lib/logger";

export interface MarriottParsedProperty {
  chainPropertyId: string;
  name: string;
  subBrandName: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  chainUrlPath: string | null;
}

export interface ParseResult {
  properties: MarriottParsedProperty[];
  skippedCount: number;
}

export const BRAND_CODE_MAP: Record<string, string> = {
  FI: "Fairfield by Marriott",
  CY: "Courtyard by Marriott",
  RI: "Residence Inn",
  MC: "Marriott Hotels",
  TS: "TownePlace Suites",
  SH: "SpringHill Suites",
  SI: "Sheraton",
  FP: "Four Points by Sheraton",
  AK: "Autograph Collection",
  AR: "AC Hotels by Marriott",
  WI: "Westin",
  AL: "Aloft Hotels",
  DS: "Design Hotels",
  TX: "TRIBUTE Portfolio",
  XE: "City Express by Marriott",
  OX: "Moxy Hotels",
  BR: "Renaissance Hotels",
  DE: "Delta Hotels",
  LC: "The Luxury Collection",
  JW: "JW Marriott",
  RZ: "The Ritz-Carlton",
  EL: "Element Hotels",
  MD: "Le Méridien",
  XR: "St. Regis",
  MV: "Marriott Vacation Club",
  WH: "W Hotels",
  PR: "Protea Hotels",
  XF: "Four Points Flex by Sheraton",
  ER: "Marriott Executive Apartments",
  EB: "EDITION Hotels",
  GE: "Gaylord Hotels",
  BG: "Bvlgari Hotels & Resorts",
  BA: "Apartments by Marriott Bonvoy",
};

interface RawProperty {
  marsha_code: string;
  name: string;
  country_code: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  status: string;
  bookable: boolean;
}

interface RawCity {
  city: string;
  city_properties: RawProperty[];
}

interface RawState {
  state_cities: RawCity[];
}

interface RawCountry {
  country_code: string;
  country_states: RawState[];
}

interface RawRegion {
  region_countries: RawCountry[];
}

interface PacsysResponse {
  regions: RawRegion[];
}

function isPacsysResponse(data: unknown): data is PacsysResponse {
  return (
    data !== null && typeof data === "object" && Array.isArray((data as PacsysResponse).regions)
  );
}

function flattenRaw(data: PacsysResponse): RawProperty[] {
  const props: RawProperty[] = [];
  for (const region of data.regions) {
    for (const country of region.region_countries) {
      for (const state of country.country_states) {
        for (const city of state.state_cities) {
          props.push(...city.city_properties);
        }
      }
    }
  }
  return props;
}

export function parseMarriottBrand(brandCode: string, data: unknown): ParseResult {
  if (!isPacsysResponse(data)) return { properties: [], skippedCount: 0 };

  const allRaw = flattenRaw(data);

  if (!(brandCode in BRAND_CODE_MAP)) {
    logger.warn("marriott_parse:unknown_brand", { brandCode, propertyCount: allRaw.length });
    return { properties: [], skippedCount: 0 };
  }

  const subBrandName = BRAND_CODE_MAP[brandCode];
  const properties: MarriottParsedProperty[] = [];
  let skippedCount = 0;

  for (const raw of allRaw) {
    if (raw.status !== "A" || !raw.bookable) {
      skippedCount++;
      continue;
    }
    properties.push({
      chainPropertyId: raw.marsha_code,
      name: raw.name,
      subBrandName,
      address: raw.address || null,
      city: raw.city || null,
      countryCode: raw.country_code || null,
      latitude: raw.latitude ? parseFloat(raw.latitude) : null,
      longitude: raw.longitude ? parseFloat(raw.longitude) : null,
      chainUrlPath: null,
    });
  }

  return { properties, skippedCount };
}
