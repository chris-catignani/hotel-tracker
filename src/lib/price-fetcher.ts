/**
 * Price fetcher abstraction for hotel room rate monitoring.
 *
 * Each chain has its own fetcher implementation. All fetchers return a
 * PriceFetchResult or null if the property cannot be fetched (e.g. missing
 * chainPropertyId, missing credentials, or the chain is unsupported).
 */

export interface RoomRate {
  roomId: string; // chain-specific room ID (e.g. inventoryTypeCode for IHG, rate key for Hyatt)
  roomName: string; // human-readable room name
  ratePlanCode: string; // e.g. "IGCOR", "IDAP2", "IVANI", "IGNSL"
  ratePlanName: string; // e.g. "Best Flexible Rate", "Reward Nights"
  cashPrice: number | null; // null for pure award rates
  cashCurrency: string; // ISO currency code (e.g. "USD")
  awardPrice: number | null; // integer points; null for cash-only rates
  isRefundable: "REFUNDABLE" | "NON_REFUNDABLE" | "UNKNOWN";
  isCorporate: boolean;
}

export interface PriceFetchResult {
  rates: RoomRate[];
  source: string; // e.g. "hyatt_browser", "ihg_api"
}

export interface FetchableProperty {
  id: string;
  name: string;
  hotelChainId: string | null;
  chainPropertyId: string | null; // spiritCode for Hyatt, mnemonic for IHG
  countryCode: string | null; // ISO 3166-1 alpha-2 (e.g. "US", "KR", "FR")
}

export interface FetchParams {
  property: FetchableProperty;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults?: number;
}

export interface PriceFetcher {
  /** Returns true if this fetcher can handle the given property. */
  canFetch(property: FetchableProperty): boolean;
  /** Fetches current prices. Returns null if fetch is not possible. */
  fetchPrice(params: FetchParams): Promise<PriceFetchResult | null>;
}

/**
 * Selects the appropriate fetcher for a property, trying each in order.
 * Returns null if no fetcher can handle it.
 */
export function selectFetcher(
  property: FetchableProperty,
  fetchers: PriceFetcher[]
): PriceFetcher | null {
  return fetchers.find((f) => f.canFetch(property)) ?? null;
}

/**
 * Derives the lowest refundable cash price and currency from a set of room rates.
 * UNKNOWN rates are included — omitting them would produce a misleading "—" for
 * chains like GHA where refundability data is simply not available from the API.
 */
export function lowestRefundableCash(rates: RoomRate[]): {
  price: number | null;
  currency: string;
} {
  let price: number | null = null;
  let currency = "USD";
  for (const r of rates) {
    if (r.isRefundable !== "NON_REFUNDABLE" && r.cashPrice !== null) {
      if (price === null || r.cashPrice < price) {
        price = r.cashPrice;
        currency = r.cashCurrency;
      }
    }
  }
  return { price, currency };
}

/** Derives the lowest award price (in points) from a set of room rates. */
export function lowestAward(rates: RoomRate[]): number | null {
  let price: number | null = null;
  for (const r of rates) {
    if (r.awardPrice !== null) {
      if (price === null || r.awardPrice < price) {
        price = r.awardPrice;
      }
    }
  }
  return price;
}

/**
 * Derives the lowest award price (in points) preferring refundable/unknown rates,
 * falling back to the overall lowest if no refundable/unknown award rates exist.
 * Mirrors the same refundability filter used by lowestRefundableCash.
 */
export function lowestRefundableAward(rates: RoomRate[]): number | null {
  const refundable = rates.filter((r) => r.isRefundable !== "NON_REFUNDABLE");
  return lowestAward(refundable) ?? lowestAward(rates);
}
