/**
 * Hyatt price fetcher.
 *
 * Uses Hyatt's internal JSON API:
 *   GET https://www.hyatt.com/shop/service/rooms/roomrates/{spiritCode}
 *
 * Authentication: requires an anonymous browser session cookie stored in
 * the HYATT_SESSION_COOKIE environment variable. Obtain the cookie by
 * visiting hyatt.com in a browser and copying the full Cookie header value.
 * The cookie typically expires after hours–days and must be refreshed manually
 * (or via a Playwright step in CI).
 *
 * spiritCode: 5-character lowercase code visible in every Hyatt property URL.
 * Example: https://www.hyatt.com/en-US/hotel/illinois/park-hyatt-chicago/chiph
 *          → spiritCode = "chiph"
 *
 * Store the spiritCode in Property.chainPropertyId when adding a Hyatt property.
 */

import { HOTEL_ID } from "@/lib/constants";
import type {
  FetchableProperty,
  FetchParams,
  PriceFetcher,
  PriceFetchResult,
} from "@/lib/price-fetcher";

const HYATT_RATES_URL = "https://www.hyatt.com/shop/service/rooms/roomrates";

export class HyattFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HyattFetchError";
  }
}

interface HyattRoomRate {
  lowestAvgPointValue?: number;
  lowestAveragePrice?: { value: number; currency: string };
}

interface HyattRatesResponse {
  roomRates?: Record<string, HyattRoomRate>;
}

async function fetchHyattRates(
  spiritCode: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  cookie: string
): Promise<HyattRatesResponse | null> {
  const params = new URLSearchParams({
    rooms: "1",
    adults: String(adults),
    kids: "0",
    checkinDate: checkIn,
    checkoutDate: checkOut,
    rate: "Standard",
    rateFilter: "woh",
    // 'location' param omitted — spiritCode in the URL path is the definitive identifier
  });

  const url = `${HYATT_RATES_URL}/${spiritCode}?${params}`;

  const res = await fetch(url, {
    headers: {
      Cookie: cookie,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.hyatt.com/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    },
  });

  if (!res.ok) {
    const message =
      res.status === 429
        ? `[HyattFetcher] Rate limited (429) for ${spiritCode} — wait a few minutes and try again`
        : res.status === 403
          ? `[HyattFetcher] Unauthorized (403) for ${spiritCode} — session cookie may have expired`
          : `[HyattFetcher] HTTP ${res.status} for ${spiritCode}`;
    console.error(message);
    throw new HyattFetchError(message, res.status);
  }

  return (await res.json()) as HyattRatesResponse;
}

function parseRates(data: HyattRatesResponse): {
  cashPrice: number | null;
  cashCurrency: string;
  awardPrice: number | null;
} {
  const rates = Object.values(data.roomRates ?? {});
  if (rates.length === 0) return { cashPrice: null, cashCurrency: "USD", awardPrice: null };

  let lowestCash: number | null = null;
  let cashCurrency = "USD";
  let lowestAward: number | null = null;

  for (const rate of rates) {
    if (rate.lowestAveragePrice?.value != null) {
      if (lowestCash === null || rate.lowestAveragePrice.value < lowestCash) {
        lowestCash = rate.lowestAveragePrice.value;
        cashCurrency = rate.lowestAveragePrice.currency ?? "USD";
      }
    }
    if (rate.lowestAvgPointValue != null) {
      if (lowestAward === null || rate.lowestAvgPointValue < lowestAward) {
        lowestAward = rate.lowestAvgPointValue;
      }
    }
  }

  return { cashPrice: lowestCash, cashCurrency, awardPrice: lowestAward };
}

export class HyattFetcher implements PriceFetcher {
  private cookie: string;

  constructor(cookie: string) {
    this.cookie = cookie;
  }

  canFetch(property: FetchableProperty): boolean {
    return property.hotelChainId === HOTEL_ID.HYATT && !!property.chainPropertyId;
  }

  async fetchPrice(params: FetchParams): Promise<PriceFetchResult | null> {
    const spiritCode = params.property.chainPropertyId;
    if (!spiritCode) return null;

    const data = await fetchHyattRates(
      spiritCode,
      params.checkIn,
      params.checkOut,
      params.adults ?? 1,
      this.cookie
    );
    if (!data) return null;

    const { cashPrice, cashCurrency, awardPrice } = parseRates(data);
    return { cashPrice, cashCurrency, awardPrice, source: "hyatt_scraper" };
  }
}

/** Creates a HyattFetcher if HYATT_SESSION_COOKIE is set, otherwise null. */
export function createHyattFetcher(): HyattFetcher | null {
  const cookie = process.env.HYATT_SESSION_COOKIE;
  if (!cookie) return null;
  return new HyattFetcher(cookie);
}
