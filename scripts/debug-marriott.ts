#!/usr/bin/env npx tsx
/**
 * Debug script for the Marriott price fetcher.
 * Fetches live rates for a given hotel and prints the parsed result.
 *
 * Usage:
 *   npx tsx scripts/debug-marriott.ts [marshaCode] [checkIn] [checkOut]
 *   npx tsx scripts/debug-marriott.ts ATLMQ 2026-05-01 2026-05-02
 */
import { MarriottFetcher } from "../src/lib/scrapers/marriott";
import { HOTEL_ID } from "../src/lib/constants";
import type { FetchParams } from "../src/lib/price-fetcher";

const marshaCode = (process.argv[2] ?? "ATLMQ").toUpperCase();
const checkIn = process.argv[3] ?? "2026-05-01";
const checkOut = process.argv[4] ?? "2026-05-02";

async function main() {
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

  console.log(`--- DEBUG MARRIOTT FETCHER ---`);
  console.log(`MARSHA code: ${marshaCode}`);
  console.log(`Dates: ${checkIn} → ${checkOut}\n`);

  const result = await fetcher.fetchPrice(params);

  if (result) {
    console.log("\n--- SUCCESS ---");
    console.log(`Source: ${result.source}`);
    console.log(`Rates (${result.rates.length} total):`);
    console.log(JSON.stringify(result.rates, null, 2));
  } else {
    console.log("\n--- FAILED ---");
    console.log("Fetcher returned null.");
  }
}

main().catch(console.error);
