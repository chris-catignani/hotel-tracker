#!/usr/bin/env npx tsx
/**
 * Debug script for the Marriott price fetcher.
 * Fetches live rates for a given hotel and prints the parsed result.
 *
 * Usage:
 *   npx tsx scripts/debug-marriott.ts [marshaCode] [checkIn] [checkOut] [--all-categories]
 *   npx tsx scripts/debug-marriott.ts ATLMQ 2026-05-01 2026-05-02
 *   npx tsx scripts/debug-marriott.ts KULOK 2026-04-10 2026-04-14 --all-categories
 */
import { chromium } from "playwright";
import { HOTEL_ID } from "../src/lib/constants";
import type { FetchParams } from "../src/lib/price-fetcher";
import type { MarriottSearchResponse } from "../src/lib/scrapers/marriott";
import { MarriottFetcher } from "../src/lib/scrapers/marriott";

const marshaCode = (process.argv[2] ?? "ATLMQ").toUpperCase();
const checkIn = process.argv[3] ?? "2026-05-01";
const checkOut = process.argv[4] ?? "2026-05-02";
const allCategories = process.argv.includes("--all-categories");

function buildSearchUrl(marshaCode: string, checkIn: string, checkOut: string): string {
  const [cy, cm, cd] = checkIn.split("-");
  const [oy, om, od] = checkOut.split("-");
  return (
    `https://www.marriott.com/reservation/availabilitySearch.mi` +
    `?propertyCode=${marshaCode}` +
    `&fromDate=${cm}/${cd}/${cy}&toDate=${om}/${od}/${oy}` +
    `&numberOfGuests=1&numberOfRooms=1&useRewardsPoints=true`
  );
}

async function fetchAllRates(): Promise<MarriottSearchResponse[]> {
  const url = buildSearchUrl(marshaCode, checkIn, checkOut);
  const userDataDir = `/tmp/marriott-debug-${Math.random().toString(36).substring(7)}`;
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    viewport: { width: 1280, height: 900 },
  });
  const responses: MarriottSearchResponse[] = [];
  try {
    const page = await context.newPage();
    let resolveDone!: () => void;
    const allDone = new Promise<void>((res) => {
      resolveDone = res;
    });
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    page.on("response", async (response) => {
      if (!response.url().includes("PhoenixBookDTTSearchProductsByProperty")) return;
      try {
        const data = (await response.json()) as MarriottSearchResponse;
        responses.push(data);
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(resolveDone, 3000);
      } catch {
        /* ignore */
      }
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await Promise.race([
      allDone,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 45000)),
    ]);
  } finally {
    await context.close();
  }
  return responses;
}

async function main() {
  console.log(`--- DEBUG MARRIOTT FETCHER ---`);
  console.log(`MARSHA code: ${marshaCode}`);
  console.log(`Dates: ${checkIn} → ${checkOut}`);
  console.log(
    `Mode: ${allCategories ? "ALL categories" : "filtered (StandardRates + Prepay only)"}\n`
  );

  if (!allCategories) {
    // Normal mode: use the real fetcher
    const fetcher = new MarriottFetcher();
    const params: FetchParams = {
      property: {
        id: "test-id",
        name: `Marriott (${marshaCode})`,
        hotelChainId: HOTEL_ID.MARRIOTT,
        chainPropertyId: marshaCode,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      checkIn,
      checkOut,
      adults: 1,
    };
    const result = await fetcher.fetchPrice(params);
    if (result) {
      console.log("--- SUCCESS ---");
      console.log(`Source: ${result.source}`);
      console.log(`Rates (${result.rates.length} total):`);
      console.log(JSON.stringify(result.rates, null, 2));
    } else {
      console.log("--- FAILED --- fetcher returned null");
    }
    return;
  }

  // --all-categories mode: dump every edge with its category code
  console.log("Fetching raw API responses...");
  const responses = await fetchAllRates();
  console.log(`Received ${responses.length} response(s)\n`);

  const categoryCounts: Record<string, number> = {};
  const allEdges: object[] = [];

  for (const resp of responses) {
    const edges = resp.data?.commerce?.product?.searchProductsByProperty?.edges ?? [];
    for (const edge of edges) {
      const node = edge.node;
      const category = node.availabilityAttributes.productRateCategory.typeCode;
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      allEdges.push({
        category,
        roomId: node.basicInformation.type,
        roomName: node.basicInformation.name,
        ratePlanCode: node.basicInformation.ratePlan?.[0]?.ratePlanCode,
        ratePlanType: node.basicInformation.ratePlan?.[0]?.ratePlanType,
        rateName: node.rates.name,
        rateDescription: node.rates.description,
        rateMode: node.rates.rateModes.__typename,
        /* eslint-disable @typescript-eslint/no-explicit-any */
        price:
          (node.rates.rateModes as any).averageNightlyRatePerUnit?.amount ??
          (node.rates.rateModes as any).pointsPerUnit ??
          /* eslint-enable @typescript-eslint/no-explicit-any */
          null,
      });
    }
  }

  console.log("--- CATEGORY SUMMARY ---");
  console.log(categoryCounts);
  console.log(`\n--- ALL EDGES (${allEdges.length} total) ---`);
  console.log(JSON.stringify(allEdges, null, 2));
}

main().catch(console.error);
