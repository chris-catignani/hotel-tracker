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
} from "@/lib/price-fetcher";

const HYATT_RATES_API_URL = "https://www.hyatt.com/shop/service/rooms/roomrates";

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

    const isCI = !!process.env.CI;
    console.log(`[HyattFetcher] Launching browser for ${spiritCode} (App Mode, CI=${isCI})...`);

    const userDataDir = `/tmp/hyatt-browser-${Math.random().toString(36).substring(7)}`;

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: isCI,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--use-gl=desktop",
        `--app=${targetApiUrl}`,
      ],
      viewport: { width: 1280, height: 800 },
    });

    try {
      await new Promise((r) => setTimeout(r, 1500));
      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/roomrates/${spiritCode}`) && response.status() === 200,
        { timeout: 60000 }
      );

      const response = await responsePromise;
      const data = (await response.json()) as HyattRatesResponse;
      const result = this.parseRates(data);

      console.log(`[HyattFetcher] Success for ${spiritCode}`);
      return result ? { ...result, source: "hyatt_browser" } : null;
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

  private parseRates(
    data: HyattRatesResponse
  ): { cashPrice: number | null; cashCurrency: string; awardPrice: number | null } | null {
    const rooms = data.roomRates ? Object.values(data.roomRates) : [];
    if (rooms.length === 0) return null;

    let lowestCash: number | null = null;
    let cashCurrency = "USD";
    let lowestAward: number | null = null;

    for (const room of rooms) {
      // 1. Check for Award Rates
      if (room.lowestAvgPointValue != null) {
        if (lowestAward === null || room.lowestAvgPointValue < lowestAward) {
          lowestAward = room.lowestAvgPointValue;
        }
      }

      // 2. Check for Cash Rates
      // We prefer searching ratePlans for more detail (like refundability)
      let foundCashInPlans = false;
      if (room.ratePlans) {
        for (const plan of room.ratePlans) {
          if (plan.rate != null && plan.rate > 0) {
            // Check if refundable: basically anything not marked non-refundable or AP (Advance Purchase)
            // Common non-refundable penaltyCode is 'CNR'. Most others (48H, 24H, 1DC) are refundable.
            const isNonRefundable = plan.penaltyCode === "CNR" || plan.id?.includes("ADPR");

            if (!isNonRefundable) {
              if (lowestCash === null || plan.rate < lowestCash) {
                lowestCash = plan.rate;
                cashCurrency = plan.currencyCode ?? room.currencyCode ?? "USD";
                foundCashInPlans = true;
              }
            }
          }
        }
      }

      // 3. Fallback to summary cash fields if no detailed plans found
      if (!foundCashInPlans) {
        // Prefer lowestPublicRate or lowestCashRate
        const summaryPrice = room.lowestPublicRate ?? room.lowestCashRate;
        if (summaryPrice != null && summaryPrice > 0) {
          if (lowestCash === null || summaryPrice < lowestCash) {
            lowestCash = summaryPrice;
            cashCurrency = room.currencyCode ?? "USD";
          }
        }
      }
    }

    return { cashPrice: lowestCash, cashCurrency, awardPrice: lowestAward };
  }
}

export function createHyattFetcher(): HyattFetcher {
  return new HyattFetcher();
}
