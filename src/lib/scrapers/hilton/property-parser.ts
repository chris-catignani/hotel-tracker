import { logger } from "@/lib/logger";
import { BRAND_CODES } from "./brand-codes";
import type { ParsedProperty } from "@/services/property-ingest-orchestrator";

export interface HiltonRawHotel {
  ctyhocn?: string;
  name?: string;
  brandCode?: string;
  address?: {
    addressLine1?: string;
    city?: string;
    country?: string;
    state?: string;
  };
  localization?: {
    coordinate?: {
      latitude?: number;
      longitude?: number;
    };
  };
}

export function parseHiltonHotel(raw: unknown): ParsedProperty | null {
  const hotel = raw as HiltonRawHotel;
  const ctyhocn = hotel.ctyhocn?.trim().toUpperCase();
  if (!ctyhocn) return null;

  const name = hotel.name?.trim();
  if (!name) return null;

  const brandCode = hotel.brandCode;
  let subBrandName: string | null = null;
  if (brandCode != null) {
    if (BRAND_CODES[brandCode] != null) {
      subBrandName = BRAND_CODES[brandCode];
    } else {
      logger.warn("hilton_parse:unknown_brand_code", { brandCode, ctyhocn, name });
      subBrandName = brandCode;
    }
  }

  return {
    chainPropertyId: ctyhocn,
    name,
    chainUrlPath: null,
    subBrandName,
    address: hotel.address?.addressLine1 ?? null,
    city: hotel.address?.city ?? null,
    countryCode: hotel.address?.country ?? null,
    latitude: hotel.localization?.coordinate?.latitude ?? null,
    longitude: hotel.localization?.coordinate?.longitude ?? null,
  };
}
