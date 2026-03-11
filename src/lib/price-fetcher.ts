/**
 * Price fetcher abstraction for hotel room rate monitoring.
 *
 * Each chain has its own fetcher implementation. All fetchers return a
 * PriceFetchResult or null if the property cannot be fetched (e.g. missing
 * chainPropertyId, missing credentials, or the chain is unsupported).
 */

export interface PriceFetchResult {
  cashPrice: number | null; // lowest available cash rate in cashCurrency
  cashCurrency: string; // ISO currency code (e.g. "USD")
  awardPrice: number | null; // lowest award cost in points; null if unavailable
  source: string; // e.g. "hyatt_scraper", "manual"
}

export interface FetchableProperty {
  id: string;
  name: string;
  hotelChainId: string | null;
  chainPropertyId: string | null; // spiritCode for Hyatt, Amadeus ID for others
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
