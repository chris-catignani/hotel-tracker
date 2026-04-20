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
 * Deduplication: The API may return multiple offers for the same rate plan.
 * We keep the cheapest offer per (roomName, offerType, ratePlanName, cancellationCode),
 * where ratePlanName comes from rate.label — the canonical name shown on the website.
 *
 * Refundability: Derived from simplifiedPolicies.cancellation.code.
 * FREE_CANCELLATION → REFUNDABLE, NO_CANCELLATION → NON_REFUNDABLE.
 */

import { HOTEL_ID } from "@/lib/constants";
import { nightsBetween } from "@/lib/utils";
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

const HOTEL_PAGE_HOT_QUERY = `
query HotelPageHot(
  $hotelOffersHotelId: String!
  $dateIn: Date!
  $dateOut: Date!
  $nbAdults: PositiveInt!
  $childrenAges: [NonNegativeInt!]
  $countryMarket: String!
) {
  hotelOffers(
    hotelId: $hotelOffersHotelId
    dateIn: $dateIn
    dateOut: $dateOut
    nbAdults: $nbAdults
    childrenAges: $childrenAges
    countryMarket: $countryMarket
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
        rate {
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
  rate?: {
    label?: string | null; // e.g. "ADVANCE SAVER RATE", "FLEXIBLE RATE", "INDULGENCE PACKAGE"
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
        },
        query: HOTEL_PAGE_HOT_QUERY,
      }),
    });

    if (!res.ok) {
      throw new Error(`Accor API error for ${hotelId}: HTTP ${res.status}`);
    }

    const data = (await res.json()) as AccorResponse;
    const offerCount = data.data?.hotelOffers?.offersSelection?.offers?.length ?? 0;
    console.log(`[AccorFetcher] Response for ${hotelId}: ${offerCount} raw offers`);

    const nights = nightsBetween(params.checkIn, params.checkOut);
    if (nights <= 0) return null;

    const rates = parseAccorRates(data, nights);
    console.log(`[AccorFetcher] Parsed ${rates.length} rates for ${hotelId}`);

    return rates.length > 0 ? { rates, source: "accor_api" } : null;
  }
}

/**
 * Exported for unit testing.
 * Parses room rates from an Accor BFF GraphQL response.
 *
 * Deduplicates by (roomName, offerType, ratePlanName, cancellationCode), keeping the
 * cheapest offer per unique combination. ratePlanName comes from rate.label — the
 * canonical name shown on the website (e.g. "ADVANCE SAVER RATE", "INDULGENCE PACKAGE").
 */
export function parseAccorRates(data: unknown, nights: number): RoomRate[] {
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

    // Human-readable meal plan name: EUROPEAN_PLAN has a null label from the API.
    const mealPlanLabel =
      offer.mealPlan?.label ?? (mealPlanCode === "EUROPEAN_PLAN" ? "Room only" : mealPlanCode);

    // rate.label is the canonical name shown on the Accor website, e.g.
    // "ADVANCE SAVER RATE", "FLEXIBLE RATE - BREAKFAST INCLUDED", "INDULGENCE PACKAGE".
    // Fall back to meal plan label for ROOM offers or offer type label for PACKAGE offers
    // if somehow absent.
    const ratePlanName =
      offer.rate?.label ?? (offerType === "PACKAGE" ? `Package – ${mealPlanLabel}` : mealPlanLabel);

    // Dedup key: rate.label (via ratePlanName) uniquely identifies the distinct rate plan a
    // guest would see on the website. offerType is included to guard against a hypothetical
    // ROOM/PACKAGE collision with the same display name. cancellationCode separates refundable
    // vs non-refundable variants of the same rate (rare but defensive).
    const key = `${roomName}|${offerType}|${ratePlanName}|${cancellationCode}`;

    const existing = seen.get(key);
    if (existing && Number(existing.cashPrice) <= amount) continue;

    seen.set(key, {
      roomId: roomName,
      roomName,
      ratePlanCode: `${offerType}|${mealPlanCode}|${cancellationCode}`,
      ratePlanName,
      cashPrice: amount / nights,
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
