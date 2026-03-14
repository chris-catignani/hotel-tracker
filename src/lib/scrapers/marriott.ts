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
 * - Packages → included as refundable; often the cheapest available rate (e.g. loyalty
 *   packages, breakfast bundles). Users can evaluate the included extras themselves.
 * - Redemption (HotelRoomRateModesPoints) → award prices; only returned when
 *   the search URL includes useRewardsPoints=true.
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

// Hard timeout for the entire fetch
const RATE_FETCH_TIMEOUT_MS = 45000;
// Resolve this many ms after the last rate response arrives (handles 1 or 2 calls)
const SETTLE_AFTER_LAST_RESPONSE_MS = 3000;

// Rate categories to include in output
const INCLUDED_CATEGORIES = new Set(["StandardRates", "Prepay", "Packages", "Redemption"]);

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
    `&numberOfGuests=1&numberOfRooms=1&useRewardsPoints=true`
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

      // Resolve once rate responses stop arriving (settle window).
      // Some sub-brands (e.g. Moxy) only make 1 PhoenixBookDTT call; others make 2.
      // Using a settle timer handles both cases without hard-coding a count.
      let resolveDone!: () => void;
      const allDone = new Promise<void>((res) => {
        resolveDone = res;
      });
      let settleTimer: ReturnType<typeof setTimeout> | null = null;

      page.on("response", async (response) => {
        if (!response.url().includes("PhoenixBookDTTSearchProductsByProperty")) return;
        try {
          const data = (await response.json()) as MarriottSearchResponse;
          rateResponses.push(data);
          // Reset the settle timer — resolve 3 s after the last response arrives
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(resolveDone, SETTLE_AFTER_LAST_RESPONSE_MS);
        } catch {
          // ignore parse errors
        }
      });

      console.log(`[MarriottFetcher] Navigating to availability page for ${marshaCode}...`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {
        // Marriott redirects to rateListMenu.mi — navigation event is expected
      });

      // Wait for responses to settle or hard timeout
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
        fs.rmSync(userDataDir, { recursive: true, force: true });
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
export function parseMarriottRates(responses: unknown[]): RoomRate[] {
  // Dedup key: roomName|ratePlanName
  // - roomName instead of roomId: Marriott assigns multiple physical inventory IDs
  //   (e.g. d000000038–d000000041) to the same room type. Using the display name
  //   collapses these into one logical room.
  // - ratePlanName instead of ratePlanCode: member and non-member rates often share
  //   the same ratePlanCode (e.g. "XDRZ") but have distinct names ("Member Flexible
  //   Rate" vs "Flexible Rate") and different prices.
  const seen = new Set<string>(); // roomName|ratePlanName
  const result: RoomRate[] = [];

  for (const respRaw of responses) {
    const resp = respRaw as MarriottSearchResponse;
    const edges = resp.data?.commerce?.product?.searchProductsByProperty?.edges ?? [];

    for (const edge of edges) {
      const node = edge.node;
      const categoryCode = node.availabilityAttributes.productRateCategory.typeCode;

      if (!INCLUDED_CATEGORIES.has(categoryCode)) continue;

      // Use roomName as roomId — physical inventory IDs are opaque internal codes
      const roomName = node.basicInformation.name;
      const ratePlanCode = node.basicInformation.ratePlan?.[0]?.ratePlanCode ?? "STANDARD";
      const ratePlanName = node.rates.name;
      const isRefundable: "REFUNDABLE" | "NON_REFUNDABLE" =
        categoryCode !== "Prepay" ? "REFUNDABLE" : "NON_REFUNDABLE";
      const rateMode = node.rates.rateModes;

      const dedupeKey = `${roomName}|${ratePlanName}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      if (rateMode.__typename === "HotelRoomRateModesCash") {
        const amtData = (rateMode as MarriottRateModesCash).averageNightlyRatePerUnit.amount;
        const cashPrice = amtData.amount / Math.pow(10, amtData.decimalPoint);
        if (!isFinite(cashPrice) || cashPrice <= 0) continue;

        result.push({
          roomId: roomName,
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
          roomId: roomName,
          roomName,
          ratePlanCode,
          ratePlanName,
          cashPrice: null,
          cashCurrency: "USD",
          awardPrice: pts,
          isRefundable: "REFUNDABLE",
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
