/**
 * Marriott price fetcher (Playwright Edition).
 *
 * Strategy: Navigate to the Marriott availability search page in a headed
 * browser and intercept the internal GraphQL calls the React frontend makes
 * to `/mi/query/PhoenixBookDTTSearchProductsByProperty`.
 *
 * Akamai Bot Manager blocks plain HTTP requests to this API — the browser
 * approach (non-headless) passes Akamai's JS challenge. In CI, xvfb-run
 * provides a virtual display.
 *
 * Rate parsing strategy:
 * - StandardRates → refundable cash rates
 * - Prepay → non-refundable cash rates
 * - Packages → excluded (bundled extras make direct price comparison misleading)
 * - Points rates (HotelRoomRateModesPoints) → award prices; require an
 *   authenticated Bonvoy session so they won't appear for unauthenticated fetches.
 *
 * Hotel ID format: MARSHA code — 5-character alphanumeric (e.g. "ATLMQ").
 * Visible in Marriott booking URLs: marriott.com/hotels/travel/atlmq-hotel-name/
 */

import fs from "fs";
import { chromium } from "playwright";
import { HOTEL_ID } from "@/lib/constants";
import type {
  FetchableProperty,
  FetchParams,
  PriceFetcher,
  PriceFetchResult,
  RoomRate,
} from "@/lib/price-fetcher";

// How long to wait for both rate API calls to complete
const RATE_FETCH_TIMEOUT_MS = 45000;

// Rate categories to include in output (Packages excluded)
const INCLUDED_CATEGORIES = new Set(["StandardRates", "Prepay"]);

// ------- API response types -------

interface MarriottMonetaryAmount {
  amount: number;
  currency: string;
  decimalPoint: number;
}

interface MarriottRateModesCash {
  __typename: "HotelRoomRateModesCash";
  averageNightlyRatePerUnit: {
    amount: MarriottMonetaryAmount;
  };
}

interface MarriottRateModesPoints {
  __typename: "HotelRoomRateModesPoints";
  pointsPerUnit: {
    points: number;
    pointsSaved?: number;
    freeNights?: number;
  };
}

interface MarriottRateModesCashAndPoints {
  __typename: "HotelRoomRateModesCashAndPoints";
  cashAndPointsPerUnit: {
    points: number;
    amount: MarriottMonetaryAmount;
  };
}

type MarriottRateModes =
  | MarriottRateModesCash
  | MarriottRateModesPoints
  | MarriottRateModesCashAndPoints
  | { __typename: string };

interface MarriottProductEdge {
  node: {
    basicInformation: {
      name: string;
      type: string;
      ratePlan?: Array<{
        ratePlanCode: string;
        ratePlanType?: string;
      }>;
    };
    availabilityAttributes: {
      productRateCategory: {
        typeCode: string;
      };
    };
    rates: {
      name: string;
      description: string | null;
      rateModes: MarriottRateModes;
    };
  };
}

export interface MarriottSearchResponse {
  data?: {
    commerce?: {
      product?: {
        searchProductsByProperty?: {
          edges?: MarriottProductEdge[];
        };
      };
    };
  };
}

// ------- URL builder -------

function buildSearchUrl(marshaCode: string, checkIn: string, checkOut: string): string {
  const [cy, cm, cd] = checkIn.split("-");
  const [oy, om, od] = checkOut.split("-");
  const fromDate = `${cm}/${cd}/${cy}`;
  const toDate = `${om}/${od}/${oy}`;
  return (
    `https://www.marriott.com/reservation/availabilitySearch.mi` +
    `?propertyCode=${marshaCode}` +
    `&fromDate=${fromDate}&toDate=${toDate}` +
    `&numberOfGuests=1&numberOfRooms=1&useRewardsPoints=false`
  );
}

// ------- Fetcher class -------

export class MarriottFetcher implements PriceFetcher {
  canFetch(property: FetchableProperty): boolean {
    return property.hotelChainId === HOTEL_ID.MARRIOTT && !!property.chainPropertyId;
  }

  async fetchPrice(params: FetchParams): Promise<PriceFetchResult | null> {
    const marshaCode = params.property.chainPropertyId;
    if (!marshaCode) return null;

    console.log(`[MarriottFetcher] Fetching rates for ${marshaCode}...`);

    const url = buildSearchUrl(marshaCode, params.checkIn, params.checkOut);
    const userDataDir = `/tmp/marriott-browser-${Math.random().toString(36).substring(7)}`;

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      viewport: { width: 1280, height: 900 },
    });

    try {
      const page = await context.newPage();
      const rateResponses: MarriottSearchResponse[] = [];

      // Resolve when we've collected both rate API calls (member + standard)
      let resolveDone!: () => void;
      const allDone = new Promise<void>((res) => {
        resolveDone = res;
      });

      page.on("response", async (response) => {
        if (!response.url().includes("PhoenixBookDTTSearchProductsByProperty")) return;
        try {
          const data = (await response.json()) as MarriottSearchResponse;
          rateResponses.push(data);
          if (rateResponses.length >= 2) resolveDone();
        } catch {
          // ignore parse errors
        }
      });

      console.log(`[MarriottFetcher] Navigating to availability page for ${marshaCode}...`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {
        // Marriott redirects to rateListMenu.mi — navigation event is expected
      });

      // Wait for both rate calls or timeout
      await Promise.race([
        allDone,
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${RATE_FETCH_TIMEOUT_MS}ms`)),
            RATE_FETCH_TIMEOUT_MS
          )
        ),
      ]);

      const callCount = rateResponses.length;
      console.log(`[MarriottFetcher] Received ${callCount} rate response(s) for ${marshaCode}`);
      if (callCount === 0) return null;

      const rates = parseMarriottRates(rateResponses);
      console.log(`[MarriottFetcher] Parsed ${rates.length} rates for ${marshaCode}`);
      return rates.length > 0 ? { rates, source: "marriott_browser" } : null;
    } catch (err) {
      console.error(`[MarriottFetcher] Error for ${marshaCode}:`, err);
      return null;
    } finally {
      await context.close();
      try {
        if (fs.existsSync(userDataDir)) {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

// ------- Rate parser -------

/**
 * Exported for unit testing.
 * Merges + deduplicates rates from multiple PhoenixBookDTTSearchProductsByProperty responses.
 */
export function parseMarriottRates(responses: MarriottSearchResponse[]): RoomRate[] {
  const seen = new Set<string>(); // roomId|ratePlanCode
  const result: RoomRate[] = [];

  for (const resp of responses) {
    const edges = resp.data?.commerce?.product?.searchProductsByProperty?.edges ?? [];

    for (const edge of edges) {
      const node = edge.node;
      const categoryCode = node.availabilityAttributes.productRateCategory.typeCode;

      // Skip Packages — bundled extras distort direct price comparison
      if (!INCLUDED_CATEGORIES.has(categoryCode)) continue;

      const roomId = node.basicInformation.type;
      const roomName = node.basicInformation.name;
      const ratePlanCode = node.basicInformation.ratePlan?.[0]?.ratePlanCode ?? "STANDARD";
      const ratePlanName = node.rates.name;
      const isRefundable = categoryCode !== "Prepay";
      const rateMode = node.rates.rateModes;

      const dedupeKey = `${roomId}|${ratePlanCode}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      if (rateMode.__typename === "HotelRoomRateModesCash") {
        const amtData = (rateMode as MarriottRateModesCash).averageNightlyRatePerUnit.amount;
        const cashPrice = amtData.amount / Math.pow(10, amtData.decimalPoint);
        if (!isFinite(cashPrice) || cashPrice <= 0) continue;

        result.push({
          roomId,
          roomName,
          ratePlanCode,
          ratePlanName,
          cashPrice,
          cashCurrency: amtData.currency,
          awardPrice: null,
          isRefundable,
          isCorporate: false,
        });
      } else if (rateMode.__typename === "HotelRoomRateModesPoints") {
        const pts = (rateMode as MarriottRateModesPoints).pointsPerUnit.points;
        if (!isFinite(pts) || pts <= 0) continue;

        result.push({
          roomId,
          roomName,
          ratePlanCode,
          ratePlanName,
          cashPrice: null,
          cashCurrency: "USD",
          awardPrice: pts,
          isRefundable: true,
          isCorporate: false,
        });
      }
      // CashAndPoints and other modes: skip (rare, complex)
    }
  }

  return result;
}

export function createMarriottFetcher(): MarriottFetcher {
  return new MarriottFetcher();
}
