#!/usr/bin/env npx tsx
/**
 * Captures raw Hilton GraphQL API responses and saves them as fixture files.
 *
 * Usage:
 *   xvfb-run npx tsx scripts/capture-hilton-fixtures.ts [ctyhocn] [checkIn] [checkOut]
 *   xvfb-run npx tsx scripts/capture-hilton-fixtures.ts KULDT 2026-04-01 2026-04-02
 *
 * Saves:
 *   src/lib/scrapers/__fixtures__/hilton-{ctyhocn}-shopavail.json
 *   src/lib/scrapers/__fixtures__/hilton-{ctyhocn}-roomrates-{firstRoomCode}.json
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const ctyhocn = (process.argv[2] ?? "KULDT").toUpperCase();
const checkIn = process.argv[3] ?? "2026-04-01";
const checkOut = process.argv[4] ?? "2026-04-02";

const FIXTURES_DIR = path.join(__dirname, "../src/lib/scrapers/__fixtures__");
const GRAPHQL_BASE = "https://www.hilton.com/graphql/customer";
const OPERATION_NAME = "hotel_shopAvailOptions_shopPropAvail";
const APP_NAME = "dx-res-ui";
const APP_VERSION = "dx-res-ui:780361";

// Re-use the same simplified query as the scraper
const ROOM_RATES_QUERY = `query hotel_shopAvailOptions_shopPropAvail($arrivalDate: String!, $ctyhocn: String!, $departureDate: String!, $language: String!, $guestLocationCountry: String, $numAdults: Int!, $numChildren: Int!, $numRooms: Int!, $displayCurrency: String, $guestId: BigInt, $specialRates: ShopSpecialRateInput, $rateCategoryTokens: [String], $selectedRoomRateCodes: [ShopRoomRateCodeInput!], $ratePlanCodes: [String], $cacheId: String!, $knownGuest: Boolean, $selectedRoomTypeCode: String, $childAges: [Int], $adjoiningRoomStay: Boolean, $modifyingReservation: Boolean, $programAccountId: BigInt, $ratePlanDescEnhance: Boolean, $includeCUCEligibility: Boolean) { hotel(ctyhocn: $ctyhocn, language: $language) { shopAvail(cacheId: $cacheId input: {guestLocationCountry: $guestLocationCountry, arrivalDate: $arrivalDate, departureDate: $departureDate, displayCurrency: $displayCurrency, numAdults: $numAdults, numChildren: $numChildren, numRooms: $numRooms, guestId: $guestId, specialRates: $specialRates, rateCategoryTokens: $rateCategoryTokens, selectedRoomRateCodes: $selectedRoomRateCodes, ratePlanCodes: $ratePlanCodes, knownGuest: $knownGuest, childAges: $childAges, adjoiningRoomStay: $adjoiningRoomStay, modifyingReservation: $modifyingReservation, programAccountId: $programAccountId, ratePlanDescEnhance: $ratePlanDescEnhance, includeCUCEligibility: $includeCUCEligibility}) { currencyCode roomTypes(filter: {roomTypeCode: $selectedRoomTypeCode}) { roomTypeCode roomTypeName roomOnlyRates { ratePlanCode rateAmount guarantee { nonRefundable } ratePlan { ratePlanName advancePurchase } } redemptionRoomRates(first: 1) { ratePlanCode pointDetails(perNight: true) { pointsRate } ratePlan { ratePlanName redemptionType } guarantee { nonRefundable } } } } } }`;

async function main() {
  console.log(`Capturing Hilton fixtures: ${ctyhocn} (${checkIn} → ${checkOut})`);

  const bookingUrl =
    `https://www.hilton.com/en/book/reservation/rooms/` +
    `?ctyhocn=${ctyhocn}&arrivalDate=${checkIn}&departureDate=${checkOut}&numAdults=1&numRooms=1`;

  const userDataDir = `/tmp/hilton-capture-${Math.random().toString(36).substring(7)}`;
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--use-gl=desktop"],
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = await context.newPage();

    let cacheId: string | null = null;
    page.on("request", (req) => {
      if (req.url().includes("originalOpName=getShopAvail") && req.method() === "POST") {
        try {
          const body = JSON.parse(req.postData() ?? "{}") as {
            variables?: { cacheId?: string };
          };
          cacheId = body.variables?.cacheId ?? null;
        } catch {
          /* ignore */
        }
      }
    });

    const shopAvailPromise = page.waitForResponse(
      (r) => r.url().includes("originalOpName=getShopAvail") && r.status() === 200,
      { timeout: 60000 }
    );

    console.log("Navigating to booking page...");
    await page.goto(bookingUrl, { waitUntil: "domcontentloaded" });

    console.log("Waiting for getShopAvail...");
    const shopAvailResp = await shopAvailPromise;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shopAvailData = (await shopAvailResp.json()) as any;

    const shopAvailFile = path.join(FIXTURES_DIR, `hilton-${ctyhocn.toLowerCase()}-shopavail.json`);
    fs.writeFileSync(shopAvailFile, JSON.stringify(shopAvailData, null, 2));
    console.log(`✓ Saved getShopAvail → ${shopAvailFile}`);

    if (!cacheId) throw new Error("Could not capture cacheId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomTypes = (shopAvailData?.data?.hotel?.shopAvail?.roomTypes ?? []) as any[];
    const firstRoom = roomTypes.find((r: { roomTypeCode?: string }) => !!r.roomTypeCode);
    if (!firstRoom) throw new Error("No room types found in getShopAvail response");

    const selectedRoomTypeCode: string = firstRoom.roomTypeCode;
    console.log(`Fetching getRoomRates for first room: ${selectedRoomTypeCode}...`);

    const variables = {
      guestLocationCountry: null,
      arrivalDate: checkIn,
      departureDate: checkOut,
      numAdults: 1,
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
      cacheId,
      knownGuest: false,
      modifyingReservation: false,
      childAges: null,
      adjoiningRoomStay: false,
      includeCUCEligibility: false,
      selectedRoomTypeCode,
      ratePlanDescEnhance: true,
    };

    const graphqlUrl = new URL(GRAPHQL_BASE);
    graphqlUrl.searchParams.set("appName", APP_NAME);
    graphqlUrl.searchParams.set("appVersion", APP_VERSION);
    graphqlUrl.searchParams.set("operationName", OPERATION_NAME);
    graphqlUrl.searchParams.set("originalOpName", "getRoomRates");
    graphqlUrl.searchParams.set("bl", "en");
    graphqlUrl.searchParams.set("ctyhocn", ctyhocn);

    const roomRatesData = await page.evaluate(
      async (args: { url: string; body: string }): Promise<unknown> => {
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
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return response.json();
      },
      {
        url: graphqlUrl.toString(),
        body: JSON.stringify({ query: ROOM_RATES_QUERY, operationName: OPERATION_NAME, variables }),
      }
    );

    const roomRatesFile = path.join(
      FIXTURES_DIR,
      `hilton-${ctyhocn.toLowerCase()}-roomrates-${selectedRoomTypeCode.toLowerCase()}.json`
    );
    fs.writeFileSync(roomRatesFile, JSON.stringify(roomRatesData, null, 2));
    console.log(`✓ Saved getRoomRates (${selectedRoomTypeCode}) → ${roomRatesFile}`);
    console.log("\nDone.");
  } finally {
    await context.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
