/**
 * IHG price fetcher.
 *
 * Strategy: Plain HTTP POST to the IHG availability API.
 * No browser required — the API uses a static public key visible in IHG's
 * web app JS, plus per-request UUIDs for session/transaction IDs.
 *
 * Rate parsing strategy:
 * - Award rates are identified by IVAN* rate plan codes (points pricing).
 * - All other offers are treated as cash rates. IHG uses many property-specific
 *   codes (IDAPF, IDMAF, IKPCM, etc.) that vary by region — attempting to
 *   maintain an exhaustive allowlist would miss codes. Instead we parse every
 *   non-award offer and rely on `policies.isRefundable` for refundability.
 * - Currency comes from `hotel.propertyCurrency` (e.g. "MYR", "USD").
 */

import { randomUUID } from "crypto";
import { HOTEL_ID } from "@/lib/constants";
import type {
  FetchableProperty,
  FetchParams,
  PriceFetcher,
  PriceFetchResult,
  RoomRate,
} from "@/lib/price-fetcher";

const IHG_API_URL =
  "https://apis.ihg.com/availability/v3/hotels/offers?fieldset=rateDetails,rateDetails.policies,rateDetails.bonusRates,alternatePayments";

// Static public API key embedded in IHG's web app. No login required.
const IHG_API_KEY = "se9ym5iAzaW8pxfBjkmgbuGjJcr3Pj6Y";

// Award rate plan codes — these use points pricing (amountBeforeTax × 100 = points)
const AWARD_RATE_CODES = new Set(["IVAN1", "IVAN3", "IVAN5", "IVAN6", "IVAN7", "IVANI"]);

// IHG API response types
interface IhgProductDefinition {
  inventoryTypeCode: string;
  inventoryTypeName?: string;
}

interface IhgOffer {
  ratePlanCode?: string;
  productUses?: Array<{
    inventoryTypeCode?: string;
  }>;
  policies?: {
    isRefundable?: boolean;
  };
  totalRate?: {
    amountBeforeTax?: string;
  };
}

interface IhgRatePlanDefinition {
  code?: string;
  name?: string;
  additionalDescriptions?: {
    shortRateName?: string;
  };
}

interface IhgHotel {
  propertyCurrency?: string;
  productDefinitions?: IhgProductDefinition[];
  ratePlanDefinitions?: IhgRatePlanDefinition[];
  rateDetails?: {
    offers?: IhgOffer[];
  };
}

export interface IhgResponse {
  hotels?: IhgHotel[];
}

export class IhgFetcher implements PriceFetcher {
  canFetch(property: FetchableProperty): boolean {
    return property.hotelChainId === HOTEL_ID.IHG && !!property.chainPropertyId;
  }

  async fetchPrice(params: FetchParams): Promise<PriceFetchResult | null> {
    const mnemonic = params.property.chainPropertyId;
    if (!mnemonic) return null;

    console.log(`[IhgFetcher] Fetching rates for ${mnemonic}...`);

    const res = await fetch(IHG_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-ihg-api-key": IHG_API_KEY,
        "ihg-sessionid": randomUUID(),
        "ihg-transactionid": randomUUID(),
        "ihg-language": "en-GB",
        Origin: "https://www.ihg.com",
        Referer: "https://www.ihg.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: JSON.stringify({
        startDate: params.checkIn,
        endDate: params.checkOut,
        hotelMnemonics: [mnemonic],
        rates: {
          ratePlanCodes: [
            { internal: "IGCOR" },
            { internal: "IDAP2" },
            { internal: "IVAN1" },
            { internal: "IVAN3" },
            { internal: "IVAN5" },
            { internal: "IVAN6" },
            { internal: "IVAN7" },
            { internal: "IVANI" },
          ],
        },
        products: [
          {
            productCode: "SR",
            startDate: params.checkIn,
            endDate: params.checkOut,
            quantity: 1,
            guestCounts: [{ otaCode: "AQC10", count: params.adults ?? 1 }],
          },
        ],
        options: {
          disabilityMode: "ACCESSIBLE_AND_NON_ACCESSIBLE",
          returnAdditionalRatePlanDescriptions: true,
          rateDetails: { includePackageDetails: true },
        },
      }),
    });

    if (!res.ok) {
      console.error(`[IhgFetcher] API error for ${mnemonic}: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as IhgResponse;
    const hotel = data.hotels?.[0];
    const offerCount = hotel?.rateDetails?.offers?.length ?? 0;
    const roomCount = hotel?.productDefinitions?.length ?? 0;
    console.log(
      `[IhgFetcher] Response for ${mnemonic}: ${roomCount} room types, ${offerCount} offers (currency: ${hotel?.propertyCurrency ?? "unknown"})`
    );

    const rates = parseIhgRates(data);
    console.log(`[IhgFetcher] Parsed ${rates.length} rates for ${mnemonic}`);

    return rates.length > 0 ? { rates, source: "ihg_api" } : null;
  }
}

/**
 * Exported for unit testing.
 * Parses room rates from an IHG availability API response.
 */
export function parseIhgRates(data: IhgResponse): RoomRate[] {
  const hotel = data.hotels?.[0];
  if (!hotel) return [];

  const currency = hotel.propertyCurrency ?? "USD";

  // Build a lookup map: ratePlanCode → human-readable name from the API
  const ratePlanNames = new Map<string, string>();
  for (const def of hotel.ratePlanDefinitions ?? []) {
    if (def.code) {
      const name =
        def.additionalDescriptions?.shortRateName?.trim() || def.name?.trim() || def.code;
      ratePlanNames.set(def.code, name);
    }
  }

  // Build a lookup map: inventoryTypeCode → room name
  const roomNames = new Map<string, string>();
  for (const def of hotel.productDefinitions ?? []) {
    if (def.inventoryTypeCode) {
      roomNames.set(def.inventoryTypeCode, def.inventoryTypeName ?? def.inventoryTypeCode);
    }
  }

  const offers = hotel.rateDetails?.offers ?? [];
  const result: RoomRate[] = [];

  for (const offer of offers) {
    const ratePlanCode = offer.ratePlanCode;
    if (!ratePlanCode) continue;

    const roomId = offer.productUses?.[0]?.inventoryTypeCode;
    if (!roomId) continue;

    const rawAmount = offer.totalRate?.amountBeforeTax;
    if (!rawAmount) continue;

    const amount = parseFloat(rawAmount);
    if (!isFinite(amount) || amount <= 0) continue;

    const roomName = roomNames.get(roomId) ?? roomId;
    const ratePlanName = ratePlanNames.get(ratePlanCode) ?? ratePlanCode;

    if (AWARD_RATE_CODES.has(ratePlanCode)) {
      result.push({
        roomId,
        roomName,
        ratePlanCode,
        ratePlanName,
        cashPrice: null,
        cashCurrency: currency,
        awardPrice: Math.round(amount * 100),
        isRefundable: true,
        isCorporate: false,
      });
    } else {
      // Treat all non-award offers as cash rates.
      // IHG uses many regional/property-specific codes; rely on the API's
      // isRefundable flag rather than an allowlist of known codes.
      result.push({
        roomId,
        roomName,
        ratePlanCode,
        ratePlanName,
        cashPrice: amount,
        cashCurrency: currency,
        awardPrice: null,
        isRefundable: offer.policies?.isRefundable ?? true,
        isCorporate: false,
      });
    }
  }

  return result;
}

export function createIhgFetcher(): IhgFetcher {
  return new IhgFetcher();
}
