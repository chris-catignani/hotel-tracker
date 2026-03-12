/**
 * Hyatt price fetcher (Playwright Edition).
 *
 * Strategy: Launch a headed browser in "App Mode" directly to the API URL.
 * This bypasses Kasada bot detection by mimicking a direct user invocation
 * of the browser (like opening a PWA or a desktop shortcut).
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

// BROWSER_INITIALIZATION_WAIT_MS: It can take a moment for the browser's
// app mode window to initialize and make the request.
const BROWSER_INITIALIZATION_WAIT_MS = 1500;

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
  ratePlans?: Array<{
    id?: string;
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

    return this.fetchViaBrowser(spiritCode, params);
  }

  private async fetchViaBrowser(
    spiritCode: string,
    params: FetchParams
  ): Promise<PriceFetchResult | null> {
    const query = new URLSearchParams({
      rooms: "1",
      adults: String(params.adults ?? 1),
      kids: "0",
      checkinDate: params.checkIn,
      checkoutDate: params.checkOut,
      rate: "Standard",
      rateFilter: "woh",
    });

    const targetApiUrl = `${HYATT_RATES_API_URL}/${spiritCode}?${query.toString()}`;

    console.log(`[HyattFetcher] Launching browser for ${spiritCode} (App Mode)...`);

    const userDataDir = `/tmp/hyatt-browser-${Math.random().toString(36).substring(7)}`;

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
      // Find the page opened by the --app flag
      await new Promise((r) => setTimeout(r, BROWSER_INITIALIZATION_WAIT_MS));
      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();

      console.log(`[HyattFetcher] Waiting for rates response...`);

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/roomrates/${spiritCode}`) && response.status() === 200,
        { timeout: 60000 }
      );

      const response = await responsePromise;
      const data = (await response.json()) as HyattRatesResponse;
      const rates = parseHyattRates(data);

      console.log(`[HyattFetcher] Success for ${spiritCode}`);
      return rates.length > 0 ? { rates, source: "hyatt_browser" } : null;
    } catch (err) {
      console.error(`[HyattFetcher] App Mode fetch failed for ${spiritCode}:`, err);
      return null;
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

/** Exported for unit testing. Parses the Hyatt room rates API response into RoomRate[]. */
export function parseHyattRates(data: HyattRatesResponse): RoomRate[] {
  const roomEntries = data.roomRates ? Object.entries(data.roomRates) : [];
  if (roomEntries.length === 0) return [];

  const result: RoomRate[] = [];

  for (const [roomKey, room] of roomEntries) {
    const currency = room.currencyCode ?? "USD";
    // Use ratePlanCategory from first plan as room name if available
    const roomName = room.ratePlans?.[0]?.ratePlanCategory ?? roomKey;

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
            ratePlanName: plan.ratePlanType ?? plan.ratePlanCategory ?? plan.id ?? "Standard Rate",
            cashPrice: plan.rate,
            cashCurrency: plan.currencyCode ?? currency,
            awardPrice: null,
            isRefundable: !isNonRefundable,
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
          isRefundable: true,
          isCorporate: false,
        });
      }
    }

    // Award rate entry (one per room if available)
    if (room.lowestAvgPointValue != null) {
      result.push({
        roomId: roomKey,
        roomName,
        ratePlanCode: "AWARD",
        ratePlanName: "Award Rate",
        cashPrice: null,
        cashCurrency: currency,
        awardPrice: room.lowestAvgPointValue,
        isRefundable: true,
        isCorporate: false,
      });
    }
  }

  return result;
}

export function createHyattFetcher(): HyattFetcher {
  return new HyattFetcher();
}
