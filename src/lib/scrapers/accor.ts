/**
 * Accor price fetcher.
 *
 * Strategy: Plain HTTP POST to the Accor BFF GraphQL endpoint.
 * No browser required — the API uses a static public key visible in
 * Accor's all.accor.com web app, the same approach as IHG.
 *
 * Endpoint: POST https://api.accor.com/bff/v1/graphql
 * Operation: HotelPageHot — returns all available room offers for a hotel
 * and date range, with pricing and cancellation policy.
 *
 * chainPropertyId format: alphanumeric hotel ID (e.g. "C3M1", "3434").
 * Found in hotel page URLs: https://all.accor.com/hotel/C3M1/index.en.shtml
 *
 * Award/points pricing: Accor's ALL programme gives cashback discounts,
 * not points-for-room redemptions. awardPrice is always null.
 *
 * Deduplication: The API returns multiple offers per room type × cancellation
 * policy (e.g. different room allocations at slightly different prices).
 * We keep the cheapest offer per (roomName, cancellationCode) pair.
 *
 * Refundability: Derived from simplifiedPolicies.cancellation.code.
 * FREE_CANCELLATION → REFUNDABLE, NO_CANCELLATION → NON_REFUNDABLE.
 */

import { HOTEL_ID } from "@/lib/constants";
import type {
  FetchableProperty,
  FetchParams,
  PriceFetcher,
  PriceFetchResult,
  RoomRate,
} from "@/lib/price-fetcher";

const ACCOR_BFF_URL = "https://api.accor.com/bff/v1/graphql";

// Static public API key embedded in Accor's all.accor.com web app.
// Can be overridden via ACCOR_API_KEY env var.
const ACCOR_API_KEY = process.env.ACCOR_API_KEY ?? "l7xx5b9f4a053aaf43d8bc05bcc266dd8532";

// Maps ISO 3166-1 alpha-2 country codes to their primary currency.
// Covers the major markets where Accor operates. Falls back to USD if unknown.
const COUNTRY_CURRENCY: Record<string, string> = {
  // Asia-Pacific
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  HK: "HKD",
  TW: "TWD",
  SG: "SGD",
  MY: "MYR",
  TH: "THB",
  ID: "IDR",
  PH: "PHP",
  VN: "VND",
  IN: "INR",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  // Europe
  GB: "GBP",
  CH: "CHF",
  NO: "NOK",
  SE: "SEK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  TR: "TRY",
  // Euro zone
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
  ES: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  GR: "EUR",
  FI: "EUR",
  IE: "EUR",
  LU: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  CY: "EUR",
  MT: "EUR",
  HR: "EUR",
  AD: "EUR",
  MC: "EUR",
  SM: "EUR",
  // Americas
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  AR: "ARS",
  CO: "COP",
  CL: "CLP",
  PE: "PEN",
  // Middle East & Africa
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  EG: "EGP",
  ZA: "ZAR",
  NG: "NGN",
  // Israel
  IL: "ILS",
};

const HOTEL_PAGE_HOT_QUERY = `
query HotelPageHot(
  $hotelOffersHotelId: String!
  $dateIn: Date!
  $dateOut: Date!
  $nbAdults: PositiveInt!
  $childrenAges: [NonNegativeInt!]
  $countryMarket: String!
  $currency: String!
) {
  hotelOffers(
    hotelId: $hotelOffersHotelId
    dateIn: $dateIn
    dateOut: $dateOut
    nbAdults: $nbAdults
    childrenAges: $childrenAges
    countryMarket: $countryMarket
    currency: $currency
  ) {
    offersSelection {
      offers {
        id
        type
        description
        accommodation {
          name
        }
        mealPlan {
          code
          label
        }
        pricing {
          currency
          main {
            amount
            simplifiedPolicies {
              cancellation {
                code
                label
              }
            }
          }
        }
      }
    }
  }
}
`.trim();

// Accor BFF response types
interface AccorCancellationPolicy {
  code: string; // e.g. "FREE_CANCELLATION", "NO_CANCELLATION"
  label: string; // e.g. "Non-refundable", "Cancel free of charge until Apr 9th 6:00 PM"
}

interface AccorOffer {
  id: string;
  type?: string; // "ROOM" or "PACKAGE"
  description?: string | null; // package name (short) or long description; null for standard ROOM offers
  accommodation?: {
    name?: string;
  };
  mealPlan?: {
    code?: string; // e.g. "EUROPEAN_PLAN", "BED_AND_BREAKFAST"
    label?: string | null; // e.g. "Breakfast included"; null for EUROPEAN_PLAN
  };
  pricing?: {
    currency?: string;
    main?: {
      amount?: number;
      simplifiedPolicies?: {
        cancellation?: AccorCancellationPolicy;
      };
    };
  };
}

export interface AccorResponse {
  data?: {
    hotelOffers?: {
      offersSelection?: {
        offers?: AccorOffer[];
      };
    };
  };
}

export class AccorFetcher implements PriceFetcher {
  canFetch(property: FetchableProperty): boolean {
    return property.hotelChainId === HOTEL_ID.ACCOR && !!property.chainPropertyId;
  }

  async fetchPrice(params: FetchParams): Promise<PriceFetchResult | null> {
    const hotelId = params.property.chainPropertyId;
    if (!hotelId) return null;

    console.log(`[AccorFetcher] Fetching rates for hotelId=${hotelId}...`);

    const res = await fetch(ACCOR_BFF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: ACCOR_API_KEY,
        "app-id": "all.accor",
        clientid: "all.accor",
        lang: "en",
        Origin: "https://all.accor.com",
        Referer: "https://all.accor.com/",
      },
      body: JSON.stringify({
        operationName: "HotelPageHot",
        variables: {
          hotelOffersHotelId: hotelId,
          dateIn: params.checkIn,
          dateOut: params.checkOut,
          nbAdults: params.adults ?? 1,
          childrenAges: [],
          countryMarket: params.property.countryCode ?? "US",
          currency: COUNTRY_CURRENCY[params.property.countryCode ?? ""] ?? "USD",
        },
        query: HOTEL_PAGE_HOT_QUERY,
      }),
    });

    if (!res.ok) {
      console.error(`[AccorFetcher] API error for ${hotelId}: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as AccorResponse;
    const offerCount = data.data?.hotelOffers?.offersSelection?.offers?.length ?? 0;
    console.log(`[AccorFetcher] Response for ${hotelId}: ${offerCount} raw offers`);

    const rates = parseAccorRates(data);
    console.log(`[AccorFetcher] Parsed ${rates.length} rates for ${hotelId}`);

    return rates.length > 0 ? { rates, source: "accor_api" } : null;
  }
}

/**
 * Exported for unit testing.
 * Parses room rates from an Accor BFF GraphQL response.
 *
 * Deduplicates by (roomName, type, mealPlanCode, cancellationCode), keeping the
 * cheapest offer per unique combination. This preserves the meaningful distinctions
 * users see on the website: room-only vs breakfast-included, and standard ROOM rates
 * vs PACKAGE rates (which may have different terms).
 */
export function parseAccorRates(data: unknown): RoomRate[] {
  const response = data as AccorResponse;
  const offers = response.data?.hotelOffers?.offersSelection?.offers ?? [];

  const seen = new Map<string, RoomRate>();

  for (const offer of offers) {
    const roomName = offer.accommodation?.name;
    if (!roomName) continue;

    const amount = offer.pricing?.main?.amount;
    if (amount === undefined || amount === null || !isFinite(amount) || amount <= 0) continue;

    const currency = offer.pricing?.currency ?? "USD";
    const cancellation = offer.pricing?.main?.simplifiedPolicies?.cancellation;
    const cancellationCode = cancellation?.code ?? "UNKNOWN";
    const offerType = offer.type ?? "ROOM";
    const mealPlanCode = offer.mealPlan?.code ?? "EUROPEAN_PLAN";
    const description = offer.description ?? null;

    // Human-readable meal plan name: EUROPEAN_PLAN has a null label from the API.
    const mealPlanLabel =
      offer.mealPlan?.label ?? (mealPlanCode === "EUROPEAN_PLAN" ? "Room only" : mealPlanCode);

    // ratePlanName for PACKAGE: use description when it looks like a proper name (≤ 40 chars),
    // e.g. "INDULGENCE PACKAGE". For long marketing-copy descriptions, fall back to
    // "Package – {mealPlanLabel}". ROOM offers just use the meal plan label.
    const ratePlanName =
      offerType === "PACKAGE"
        ? description && description.length <= 40
          ? description
          : `Package – ${mealPlanLabel}`
        : mealPlanLabel;

    // PACKAGE offers include description in the key so distinct packages (e.g. INDULGENCE
    // vs WELLNESS) are never collapsed even when they share the same meal plan and
    // cancellation code. ROOM offers dedup by (roomName, mealPlanCode, cancellationCode).
    const key =
      offerType === "PACKAGE"
        ? `${roomName}|PACKAGE|${mealPlanCode}|${cancellationCode}|${description ?? ""}`
        : `${roomName}|ROOM|${mealPlanCode}|${cancellationCode}`;

    const existing = seen.get(key);
    if (existing && Number(existing.cashPrice) <= amount) continue;

    seen.set(key, {
      roomId: roomName,
      roomName,
      ratePlanCode: `${offerType}|${mealPlanCode}|${cancellationCode}`,
      ratePlanName,
      cashPrice: amount,
      cashCurrency: currency,
      awardPrice: null, // Accor ALL is cashback, not points redemption
      isRefundable:
        cancellationCode === "FREE_CANCELLATION"
          ? "REFUNDABLE"
          : cancellationCode === "NO_CANCELLATION"
            ? "NON_REFUNDABLE"
            : "UNKNOWN",
      isCorporate: false,
    });
  }

  return Array.from(seen.values());
}

export function createAccorFetcher(): AccorFetcher {
  return new AccorFetcher();
}
