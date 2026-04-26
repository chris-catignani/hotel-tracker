import { logger as defaultLogger } from "@/lib/logger";
import { subBrandNameForCode } from "./brand-codes";
import type { ParsedProperty } from "@/services/property-ingest-orchestrator";

interface WoosmapFeature {
  properties?: {
    store_id?: string;
    name?: string;
    address?: {
      lines?: string[];
      country_code?: string | null;
    };
    types?: string[];
  };
  geometry?: {
    coordinates?: [number, number];
  };
}

type WarnLogger = { warn: (message: string, extra?: Record<string, unknown>) => void };

export function parseAccorProperty(
  feature: unknown,
  logger: WarnLogger = defaultLogger
): ParsedProperty | null {
  const f = feature as WoosmapFeature;
  const props = f?.properties;

  if (!props?.store_id) return null;
  if (props.types?.[0] === "TST" || props.types?.[0] === "ELA") return null;

  const brandCode = props.types?.[0] ?? "";
  const coords = f.geometry?.coordinates;

  return {
    name: props.name ?? props.store_id,
    chainPropertyId: props.store_id,
    chainUrlPath: null,
    city: null,
    countryCode: props.address?.country_code ?? null,
    address: props.address?.lines?.[0] ?? null,
    latitude: coords ? coords[1] : null,
    longitude: coords ? coords[0] : null,
    subBrandName: subBrandNameForCode(brandCode, logger, {
      storeId: props.store_id,
      name: props.name,
    }),
  };
}
