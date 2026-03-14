/**
 * IHG price fetcher.
 *
 * Strategy: Plain HTTP POST to the IHG availability API.
 * No browser required — the API uses a static public key visible in IHG's
 * web app JS, plus per-request UUIDs for session/transaction IDs.
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

// Rate plan codes fetched from the API
const CASH_RATE_CODES = new Set(["IGCOR", "IDAP2"]);
const AWARD_RATE_CODES = new Set(["IVAN1", "IVAN3", "IVAN5", "IVAN6", "IVAN7", "IVANI"]);

// Human-readable names for known IHG rate plan codes
const RATE_PLAN_NAMES: Record<string, string> = {
  IGCOR: "Best Flexible Rate",
  IDAP2: "Advance Purchase",
  IVAN1: "Reward Night",
  IVAN3: "Reward Night",
  IVAN5: "Reward Night",
  IVAN6: "Reward Night",
  IVAN7: "Reward Night",
  IVANI: "Reward Night",
};

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

interface IhgHotel {
  productDefinitions?: IhgProductDefinition[];
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
    const rates = parseIhgRates(data);

    console.log(`[IhgFetcher] Got ${rates.length} rates for ${mnemonic}`);
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
    const ratePlanName = RATE_PLAN_NAMES[ratePlanCode] ?? ratePlanCode;

    if (CASH_RATE_CODES.has(ratePlanCode)) {
      result.push({
        roomId,
        roomName,
        ratePlanCode,
        ratePlanName,
        cashPrice: amount,
        cashCurrency: "USD",
        awardPrice: null,
        isRefundable: offer.policies?.isRefundable ?? ratePlanCode !== "IDAP2",
        isCorporate: false,
      });
    } else if (AWARD_RATE_CODES.has(ratePlanCode)) {
      result.push({
        roomId,
        roomName,
        ratePlanCode,
        ratePlanName,
        cashPrice: null,
        cashCurrency: "USD",
        awardPrice: Math.round(amount * 100),
        isRefundable: true,
        isCorporate: false,
      });
    }
  }

  return result;
}

export function createIhgFetcher(): IhgFetcher {
  return new IhgFetcher();
}
