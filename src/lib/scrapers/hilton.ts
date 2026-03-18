/**
 * Hilton price fetcher (Playwright Edition).
 *
 * Strategy: Launch a headed browser to the Hilton booking page. Hilton uses
 * a GraphQL API (POST https://www.hilton.com/graphql/customer) protected by
 * Akamai bot detection, so direct HTTP replay is not viable.
 *
 * Two-call flow:
 *   1. getShopAvail  — fires automatically on page load; returns all room types
 *      with one "quickBookRate" per room. We intercept this to get the room type
 *      list and the server-side cacheId.
 *   2. getRoomRates  — returns all rate plans for a specific room type (roomOnlyRates
 *      + redemptionRoomRates). Called once per room type via page.evaluate(fetch(...))
 *      which reuses the live Akamai session cookies.
 *
 * Hotel ID format: ctyhocn code (e.g. "NYCMHHH", "KULDT").
 * Visible in Hilton booking URLs: hilton.com/en/book/reservation/rooms/?ctyhocn=...
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

const HILTON_GRAPHQL_BASE = "https://www.hilton.com/graphql/customer";
const APP_NAME = "dx-res-ui";
const APP_VERSION = "dx-res-ui:780361";
const OPERATION_NAME = "hotel_shopAvailOptions_shopPropAvail";

// Simplified query for getRoomRates — requests only the fields we parse.
// Variables match the shape captured from DevTools (identical signature to the
// full UI query, but we only select the fields we need in the response).
const ROOM_RATES_QUERY = `query hotel_shopAvailOptions_shopPropAvail($arrivalDate: String!, $ctyhocn: String!, $departureDate: String!, $language: String!, $guestLocationCountry: String, $numAdults: Int!, $numChildren: Int!, $numRooms: Int!, $displayCurrency: String, $guestId: BigInt, $specialRates: ShopSpecialRateInput, $rateCategoryTokens: [String], $selectedRoomRateCodes: [ShopRoomRateCodeInput!], $ratePlanCodes: [String], $pnd: String, $offerId: BigInt, $cacheId: String!, $knownGuest: Boolean, $selectedRoomTypeCode: String, $childAges: [Int], $adjoiningRoomStay: Boolean, $modifyingReservation: Boolean, $programAccountId: BigInt, $ratePlanDescEnhance: Boolean, $includeCUCEligibility: Boolean) { hotel(ctyhocn: $ctyhocn, language: $language) { shopAvail(cacheId: $cacheId input: {guestLocationCountry: $guestLocationCountry, arrivalDate: $arrivalDate, departureDate: $departureDate, displayCurrency: $displayCurrency, numAdults: $numAdults, numChildren: $numChildren, numRooms: $numRooms, guestId: $guestId, specialRates: $specialRates, rateCategoryTokens: $rateCategoryTokens, selectedRoomRateCodes: $selectedRoomRateCodes, ratePlanCodes: $ratePlanCodes, knownGuest: $knownGuest, childAges: $childAges, adjoiningRoomStay: $adjoiningRoomStay, modifyingReservation: $modifyingReservation, programAccountId: $programAccountId, ratePlanDescEnhance: $ratePlanDescEnhance, includeCUCEligibility: $includeCUCEligibility}) { currencyCode roomTypes(filter: {roomTypeCode: $selectedRoomTypeCode}) { roomTypeCode roomTypeName roomOnlyRates { ratePlanCode rateAmount guarantee { nonRefundable } ratePlan { ratePlanName advancePurchase } } redemptionRoomRates(first: 1) { ratePlanCode pointDetails(perNight: true) { pointsRate } ratePlan { ratePlanName redemptionType } guarantee { nonRefundable } } } } } }`;

// --- TypeScript interfaces for parsed API responses ---

interface HiltonGuarantee {
  nonRefundable?: boolean;
}

interface HiltonRatePlanCash {
  ratePlanName?: string;
  advancePurchase?: boolean;
}

interface HiltonRatePlanAward {
  ratePlanName?: string;
  redemptionType?: string;
}

interface HiltonRoomOnlyRate {
  ratePlanCode?: string;
  rateAmount?: number;
  guarantee?: HiltonGuarantee;
  ratePlan?: HiltonRatePlanCash;
}

interface HiltonPointDetails {
  pointsRate?: number;
}

interface HiltonRedemptionRoomRate {
  ratePlanCode?: string;
  pointDetails?: HiltonPointDetails;
  ratePlan?: HiltonRatePlanAward;
  guarantee?: HiltonGuarantee;
}

interface HiltonRoomType {
  roomTypeCode?: string;
  roomTypeName?: string;
  roomOnlyRates?: HiltonRoomOnlyRate[];
  redemptionRoomRates?: HiltonRedemptionRoomRate[];
}

interface HiltonShopAvail {
  currencyCode?: string;
  roomTypes?: HiltonRoomType[];
}

export interface HiltonGraphQLResponse {
  data?: {
    hotel?: {
      ctyhocn?: string;
      shopAvail?: HiltonShopAvail;
    };
  };
}

// ---

function buildGraphqlUrl(ctyhocn: string, originalOpName: string): string {
  const params = new URLSearchParams({
    appName: APP_NAME,
    appVersion: APP_VERSION,
    operationName: OPERATION_NAME,
    originalOpName,
    bl: "en",
    ctyhocn,
  });
  return `${HILTON_GRAPHQL_BASE}?${params.toString()}`;
}

function buildRoomRatesVariables(
  ctyhocn: string,
  cacheId: string,
  selectedRoomTypeCode: string,
  params: FetchParams
): Record<string, unknown> {
  return {
    guestLocationCountry: null,
    arrivalDate: params.checkIn,
    departureDate: params.checkOut,
    numAdults: params.adults ?? 1,
    numChildren: 0,
    numRooms: 1,
    displayCurrency: null,
    ctyhocn,
    language: "en",
    guestId: null,
    specialRates: {
      aaa: false,
      governmentMilitary: false,
      hhonors: false,
      lta: false,
      pnd: "",
      senior: false,
      teamMember: false,
      owner: false,
      ownerHGV: false,
      familyAndFriends: false,
      travelAgent: false,
      smb: false,
      specialOffer: false,
      specialOfferName: null,
    },
    pnd: null,
    cacheId,
    offerId: null,
    knownGuest: false,
    modifyingReservation: false,
    childAges: null,
    adjoiningRoomStay: false,
    includeCUCEligibility: false,
    selectedRoomTypeCode,
    ratePlanDescEnhance: true,
  };
}

export class HiltonFetcher implements PriceFetcher {
  canFetch(property: FetchableProperty): boolean {
    return property.hotelChainId === HOTEL_ID.HILTON && !!property.chainPropertyId;
  }

  async fetchPrice(params: FetchParams): Promise<PriceFetchResult | null> {
    const ctyhocn = params.property.chainPropertyId!.toUpperCase();
    const userDataDir = `/tmp/hilton-browser-${Math.random().toString(36).substring(7)}`;

    const bookingUrl =
      `https://www.hilton.com/en/book/reservation/rooms/` +
      `?ctyhocn=${ctyhocn}` +
      `&arrivalDate=${params.checkIn}` +
      `&departureDate=${params.checkOut}` +
      `&numAdults=${params.adults ?? 1}` +
      `&numRooms=1`;

    console.log(`[HiltonFetcher] Launching browser for ${ctyhocn}...`);

    const context = await chromium.launchPersistentContext(userDataDir, {
      // Always non-headless: Akamai bot detection examines browser fingerprints.
      // In CI, xvfb-run in the GH Actions workflow provides a virtual display.
      headless: false,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--use-gl=desktop"],
      viewport: { width: 1280, height: 800 },
    });

    try {
      const page = await context.newPage();

      // Capture the cacheId from the getShopAvail request body before the page
      // makes the call. We need it to keep both calls in the same server cache session.
      let cacheId: string | null = null;
      page.on("request", (req) => {
        if (req.url().includes("originalOpName=getShopAvail") && req.method() === "POST") {
          try {
            const body = JSON.parse(req.postData() ?? "{}") as {
              variables?: { cacheId?: string };
            };
            cacheId = body.variables?.cacheId ?? null;
          } catch {
            // ignore parse errors
          }
        }
      });

      // Set up response interceptor before navigation so we don't miss it.
      const shopAvailPromise = page.waitForResponse(
        (r) => r.url().includes("originalOpName=getShopAvail") && r.status() === 200,
        { timeout: 60000 }
      );

      await page.goto(bookingUrl, { waitUntil: "domcontentloaded" });

      console.log(`[HiltonFetcher] Waiting for shopAvail response for ${ctyhocn}...`);
      const shopAvailResp = await shopAvailPromise;
      const shopAvailData = (await shopAvailResp.json()) as HiltonGraphQLResponse;

      if (!cacheId) {
        throw new Error(`[HiltonFetcher] Could not capture cacheId for ${ctyhocn}`);
      }

      const shopAvail = shopAvailData?.data?.hotel?.shopAvail;
      if (!shopAvail) {
        throw new Error(`[HiltonFetcher] No shopAvail data in response for ${ctyhocn}`);
      }

      const currency = shopAvail.currencyCode ?? "USD";
      const roomTypes = (shopAvail.roomTypes ?? []).filter((r) => !!r.roomTypeCode);

      console.log(
        `[HiltonFetcher] Got ${roomTypes.length} room types for ${ctyhocn} (${currency}), fetching rates...`
      );

      const rates: RoomRate[] = [];

      for (const room of roomTypes) {
        const roomTypeCode = room.roomTypeCode!;
        const roomTypeName = room.roomTypeName ?? roomTypeCode;

        const variables = buildRoomRatesVariables(ctyhocn, cacheId, roomTypeCode, params);
        const graphqlUrl = buildGraphqlUrl(ctyhocn, "getRoomRates");
        const requestBody = JSON.stringify({
          query: ROOM_RATES_QUERY,
          operationName: OPERATION_NAME,
          variables,
        });

        let roomData: unknown;
        try {
          roomData = await page.evaluate(
            async (args: { url: string; body: string }): Promise<unknown> => {
              // Extract visitorId cookie to include in custom headers (keeps
              // the header consistent with the cookie Akamai set on page load).
              const visitorId =
                document.cookie
                  .split("; ")
                  .find((c) => c.startsWith("visitorId="))
                  ?.split("=")[1] ?? "";

              const response = await fetch(args.url, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  accept: "*/*",
                  "dx-platform": "web",
                  origin: "https://www.hilton.com",
                  referer: "https://www.hilton.com/en/book/reservation/rooms/",
                  visitorid: visitorId,
                },
                body: args.body,
                signal: AbortSignal.timeout(15000),
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              return response.json();
            },
            { url: graphqlUrl, body: requestBody }
          );
        } catch (err) {
          console.warn(
            `[HiltonFetcher] getRoomRates failed for ${ctyhocn}/${roomTypeCode}: ${err instanceof Error ? err.message : String(err)}`
          );
          continue;
        }

        const roomRates = parseHiltonRoomRates(roomData, roomTypeCode, roomTypeName, currency);
        console.log(
          `[HiltonFetcher] Room ${roomTypeCode} (${roomTypeName}): ${roomRates.length} rates`
        );
        rates.push(...roomRates);
      }

      console.log(`[HiltonFetcher] Total rates for ${ctyhocn}: ${rates.length}`);
      return rates.length > 0 ? { rates, source: "hilton_browser" } : null;
    } finally {
      await context.close();
      try {
        if (fs.existsSync(userDataDir)) {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Exported for unit testing.
 * Parses room rates from a Hilton getRoomRates GraphQL response for a single room type.
 *
 * Cash rates come from `roomOnlyRates[]`.
 * Award rates come from `redemptionRoomRates[0]`.
 *
 * Refundability: explicit `guarantee.nonRefundable` boolean, with `ratePlan.advancePurchase`
 * as a fallback indicator (advance-purchase rates are always non-refundable).
 *
 * `rateAmount` is a per-night rate (Hilton's UI displays per-night pricing).
 */
export function parseHiltonRoomRates(
  data: unknown,
  roomTypeCode: string,
  roomTypeName: string,
  currency: string
): RoomRate[] {
  const response = data as HiltonGraphQLResponse;

  // Call 2 returns a single-element roomTypes array (filtered by roomTypeCode).
  const room = response?.data?.hotel?.shopAvail?.roomTypes?.[0];
  if (!room) return [];

  // Use currencyCode from the response if present (it's also in the call 2 response).
  const responseCurrency = response?.data?.hotel?.shopAvail?.currencyCode ?? currency;

  const result: RoomRate[] = [];

  // --- Cash rates ---
  for (const rate of room.roomOnlyRates ?? []) {
    const ratePlanCode = rate.ratePlanCode;
    if (!ratePlanCode) continue;

    const cashPrice = rate.rateAmount;
    if (cashPrice == null || cashPrice <= 0) continue;

    const isNonRefundable =
      rate.guarantee?.nonRefundable === true || rate.ratePlan?.advancePurchase === true;

    result.push({
      roomId: roomTypeCode,
      roomName: roomTypeName,
      ratePlanCode,
      ratePlanName: rate.ratePlan?.ratePlanName ?? ratePlanCode,
      cashPrice,
      cashCurrency: responseCurrency,
      awardPrice: null,
      isRefundable: isNonRefundable ? "NON_REFUNDABLE" : "REFUNDABLE",
      isCorporate: false,
    });
  }

  // --- Award rate ---
  const redemption = room.redemptionRoomRates?.[0];
  if (redemption?.pointDetails?.pointsRate != null && redemption.pointDetails.pointsRate > 0) {
    result.push({
      roomId: roomTypeCode,
      roomName: roomTypeName,
      ratePlanCode: redemption.ratePlanCode ?? "AWARD",
      ratePlanName: redemption.ratePlan?.ratePlanName ?? "Award Rate",
      cashPrice: null,
      cashCurrency: responseCurrency,
      awardPrice: redemption.pointDetails.pointsRate,
      isRefundable: redemption.guarantee?.nonRefundable === true ? "NON_REFUNDABLE" : "REFUNDABLE",
      isCorporate: false,
    });
  }

  return result;
}

export function createHiltonFetcher(): HiltonFetcher {
  return new HiltonFetcher();
}
