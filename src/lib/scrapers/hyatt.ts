/**
 * Hyatt price fetcher (Playwright Edition).
 *
 * Strategy: Launch a headed browser in App Mode (--app=<url>) directly to the API URL.
 * This bypasses Kasada bot detection by mimicking a direct user invocation of the browser
 * (like opening a PWA or desktop shortcut). In CI, xvfb-run provides a virtual display.
 *
 * Important: register page.waitForResponse() BEFORE the browser can receive a response —
 * i.e., immediately after the context is created, with no artificial delays before the
 * listener. The remote round-trip is long enough that this is always safe.
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

const HYATT_RATES_API_URL = "https://www.hyatt.com/shop/service/rooms/roomrates";
const AWARD_RATE_FILTER = "woh"; // World of Hyatt award rates

// Rate plan constants for refundability checks
const NON_REFUNDABLE_PENALTY_CODE = "CNR"; // Cancellation Not Refundable
const ADVANCE_PURCHASE_RATE_CODE = "ADPR"; // Advance Purchase

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
  lowestCashRate?: number;
  lowestPublicRate?: number;
  currencyCode?: string;
  lowestAvgPointValue?: number;
  roomType?: {
    title?: string;
  };
  ratePlans?: Array<{
    id?: string;
    name?: string;
    rate?: number;
    points?: number;
    ratePlanType?: string;
    ratePlanCategory?: string;
    penaltyCode?: string;
    currencyCode?: string;
  }>;
}

interface HyattRatesResponse {
  roomRates?: Record<string, HyattRoomRate>;
}

export class HyattFetcher implements PriceFetcher {
  canFetch(property: FetchableProperty): boolean {
    return property.hotelChainId === HOTEL_ID.HYATT && !!property.chainPropertyId;
  }

  async fetchPrice(params: FetchParams): Promise<PriceFetchResult | null> {
    const spiritCode = params.property.chainPropertyId;
    if (!spiritCode) return null;

    // Two sequential fetches (intentionally not parallel — avoid triggering bot detection
    // with simultaneous browser sessions from the same IP):
    // 1. No rateFilter — returns all room types with cash rates (no award prices)
    // 2. rateFilter=woh — returns only award-eligible rooms with points prices
    console.log(`[HyattFetcher] Fetching cash rates for ${spiritCode}...`);
    const cashData = await this.fetchRawResponse(spiritCode, params);
    await new Promise((r) => setTimeout(r, 3000));
    console.log(`[HyattFetcher] Fetching award rates for ${spiritCode}...`);
    const awardData = await this.fetchRawResponse(spiritCode, params, AWARD_RATE_FILTER);

    if (!cashData && !awardData) return null;

    const cashRates = cashData ? parseCashRates(cashData) : [];
    const awardMap = awardData
      ? buildAwardMap(awardData)
      : new Map<string, { points: number; currency: string }>();

    // Build a room name lookup from both responses (cash data is more complete)
    const roomNameLookup = new Map<string, string>();
    for (const [roomId, room] of Object.entries(cashData?.roomRates ?? {})) {
      if (room.roomType?.title) roomNameLookup.set(roomId, room.roomType.title);
    }
    for (const [roomId, room] of Object.entries(awardData?.roomRates ?? {})) {
      if (!roomNameLookup.has(roomId) && room.roomType?.title) {
        roomNameLookup.set(roomId, room.roomType.title);
      }
    }

    const awardEntries: RoomRate[] = [];
    for (const [roomId, { points, currency }] of awardMap.entries()) {
      awardEntries.push({
        roomId,
        roomName: roomNameLookup.get(roomId) ?? roomId,
        ratePlanCode: "AWARD",
        ratePlanName: "Award Rate",
        cashPrice: null,
        cashCurrency: currency,
        awardPrice: points,
        isRefundable: "REFUNDABLE",
        isCorporate: false,
      });
    }

    const rates = [...cashRates, ...awardEntries];
    return rates.length > 0 ? { rates, source: "hyatt_browser" } : null;
  }

  private async fetchRawResponse(
    spiritCode: string,
    params: FetchParams,
    rateFilter?: string
  ): Promise<HyattRatesResponse | null> {
    const query = new URLSearchParams({
      rooms: "1",
      adults: String(params.adults ?? 1),
      kids: "0",
      checkinDate: params.checkIn,
      checkoutDate: params.checkOut,
      rate: "Standard",
    });
    if (rateFilter) query.set("rateFilter", rateFilter);

    const targetApiUrl = `${HYATT_RATES_API_URL}/${spiritCode}?${query.toString()}`;
    const userDataDir = `/tmp/hyatt-browser-${Math.random().toString(36).substring(7)}`;

    console.log(
      `[HyattFetcher] Launching browser for ${spiritCode} (App Mode)${rateFilter ? ` [${rateFilter}]` : ""}...`
    );

    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        // Always non-headless: the Kasada bypass relies on mimicking a real browser
        // launch. In CI, xvfb-run in the GH Actions workflow provides a virtual display.
        headless: false,
        args: [
          "--disable-blink-features=AutomationControlled",
          "--no-sandbox",
          "--use-gl=desktop",
          `--app=${targetApiUrl}`,
        ],
        viewport: { width: 1280, height: 800 },
      });

      try {
        // --app= creates a page on launch; if it's not ready yet, wait for it.
        // Register the response listener immediately — the network round-trip ensures
        // we're always registered before the response can arrive.
        const page = context.pages()[0] ?? (await context.waitForEvent("page", { timeout: 5000 }));
        console.log(`[HyattFetcher] Waiting for rates response...`);

        // Log all responses for the roomrates URL to diagnose bot-detection in CI
        page.on("response", (r) => {
          if (r.url().includes("/roomrates/")) {
            console.log(`[HyattFetcher] Response: ${r.status()} ${r.url()}`);
          }
        });

        const responsePromise = page.waitForResponse(
          (response) =>
            response.url().includes(`/roomrates/${spiritCode}`) && response.status() === 200,
          { timeout: 60000 }
        );

        const response = await responsePromise;
        console.log(
          `[HyattFetcher] Success for ${spiritCode}${rateFilter ? ` [${rateFilter}]` : ""}`
        );
        return (await response.json()) as HyattRatesResponse;
      } catch (err) {
        // Screenshot on failure to diagnose what the browser is seeing (bot detection page, etc.)
        try {
          const pages = context.pages();
          if (pages.length > 0) {
            const screenshotPath = `hyatt-failure-${spiritCode}${rateFilter ? `-${rateFilter}` : ""}.png`;
            await pages[0].screenshot({ path: screenshotPath, fullPage: true });
            console.log(`[HyattFetcher] Screenshot saved: ${screenshotPath}`);
          }
        } catch {
          // Ignore screenshot errors
        }
        throw new Error(
          `Hyatt fetch failed for ${spiritCode}${rateFilter ? ` [${rateFilter}]` : ""}: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        await context.close();
      }
    } finally {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Exported for unit testing.
 * Parses cash rate plans from a Hyatt rates response (no award entries).
 */
export function parseCashRates(data: HyattRatesResponse): RoomRate[] {
  const roomEntries = data.roomRates ? Object.entries(data.roomRates) : [];
  if (roomEntries.length === 0) return [];

  const result: RoomRate[] = [];

  for (const [roomKey, room] of roomEntries) {
    const currency = room.currencyCode ?? "USD";
    const roomName = room.roomType?.title ?? roomKey;

    if (room.ratePlans && room.ratePlans.length > 0) {
      for (const plan of room.ratePlans) {
        if (plan.rate != null && plan.rate > 0) {
          const isNonRefundable =
            plan.penaltyCode === NON_REFUNDABLE_PENALTY_CODE ||
            plan.id?.includes(ADVANCE_PURCHASE_RATE_CODE);
          result.push({
            roomId: roomKey,
            roomName,
            ratePlanCode: plan.id ?? "STANDARD",
            ratePlanName: plan.name ?? plan.ratePlanType ?? plan.id ?? "Standard Rate",
            cashPrice: plan.rate,
            cashCurrency: plan.currencyCode ?? currency,
            awardPrice: null,
            isRefundable: isNonRefundable ? "NON_REFUNDABLE" : "REFUNDABLE",
            isCorporate: false,
          });
        }
      }
    } else {
      // No rate plans — use summary price
      const summaryPrice = room.lowestPublicRate ?? room.lowestCashRate;
      if (summaryPrice != null && summaryPrice > 0) {
        result.push({
          roomId: roomKey,
          roomName,
          ratePlanCode: "STANDARD",
          ratePlanName: "Standard Rate",
          cashPrice: summaryPrice,
          cashCurrency: currency,
          awardPrice: null,
          isRefundable: "REFUNDABLE",
          isCorporate: false,
        });
      }
    }
  }

  return result;
}

/**
 * Exported for unit testing.
 * Extracts the lowest award price per room from a woh-filtered response.
 */
export function buildAwardMap(
  data: HyattRatesResponse
): Map<string, { points: number; currency: string }> {
  const map = new Map<string, { points: number; currency: string }>();
  for (const [roomKey, room] of Object.entries(data.roomRates ?? {})) {
    if (room.lowestAvgPointValue != null) {
      map.set(roomKey, {
        points: room.lowestAvgPointValue,
        currency: room.currencyCode ?? "USD",
      });
    }
  }
  return map;
}

/**
 * Exported for unit testing.
 * Legacy wrapper: parses cash rates + award entries from a single response
 * (used when only one fetch is available, e.g. in older unit tests).
 */
export function parseHyattRates(data: HyattRatesResponse): RoomRate[] {
  const cashRates = parseCashRates(data);
  const awardMap = buildAwardMap(data);

  const awardEntries: RoomRate[] = [];
  for (const [roomKey, { points, currency }] of awardMap.entries()) {
    const roomName = data.roomRates?.[roomKey]?.roomType?.title ?? roomKey;
    awardEntries.push({
      roomId: roomKey,
      roomName,
      ratePlanCode: "AWARD",
      ratePlanName: "Award Rate",
      cashPrice: null,
      cashCurrency: currency,
      awardPrice: points,
      isRefundable: "REFUNDABLE",
      isCorporate: false,
    });
  }

  return [...cashRates, ...awardEntries];
}

export function createHyattFetcher(): HyattFetcher {
  return new HyattFetcher();
}
