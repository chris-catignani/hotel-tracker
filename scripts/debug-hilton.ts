#!/usr/bin/env npx tsx
/**
 * Debug script for the Hilton price fetcher.
 * Fetches live rates for a given hotel and prints the parsed result.
 *
 * Usage:
 *   npx tsx scripts/debug-hilton.ts [ctyhocn] [checkIn] [checkOut]
 *   npx tsx scripts/debug-hilton.ts NYCMHHH 2026-05-01 2026-05-02
 *   npx tsx scripts/debug-hilton.ts KULDT 2026-04-10 2026-04-11
 *
 * The ctyhocn code is visible in Hilton booking URLs:
 *   hilton.com/en/book/reservation/rooms/?ctyhocn=NYCMHHH
 */
import { HOTEL_ID } from "../src/lib/constants";
import type { FetchParams } from "../src/lib/price-fetcher";
import { HiltonFetcher } from "../src/lib/scrapers/hilton";

const ctyhocn = (process.argv[2] ?? "NYCMHHH").toUpperCase();
const checkIn = process.argv[3] ?? "2026-05-01";
const checkOut = process.argv[4] ?? "2026-05-02";

async function main() {
  console.log(`--- DEBUG HILTON FETCHER ---`);
  console.log(`ctyhocn: ${ctyhocn}`);
  console.log(`Dates: ${checkIn} → ${checkOut}\n`);

  const fetcher = new HiltonFetcher();
  const params: FetchParams = {
    property: {
      id: "test-id",
      name: `Hilton (${ctyhocn})`,
      hotelChainId: HOTEL_ID.HILTON,
      chainPropertyId: ctyhocn,
      countryCode: null,
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
}

main().catch(console.error);
