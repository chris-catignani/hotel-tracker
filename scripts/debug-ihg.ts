#!/usr/bin/env npx tsx
/**
 * Debug script to inspect the IHG availability API response shape.
 * Usage: npx tsx scripts/debug-ihg.ts [hotelCode] [checkIn] [checkOut]
 * Example: npx tsx scripts/debug-ihg.ts ORDHA 2026-04-10 2026-04-12
 */
import { randomUUID } from "crypto";

const hotelCode = process.argv[2] ?? "ORDHA";
const checkIn = process.argv[3] ?? "2026-04-10";
const checkOut = process.argv[4] ?? "2026-04-12";

async function main() {
  console.log(`Fetching IHG rates for ${hotelCode} (${checkIn} → ${checkOut})...`);

  const res = await fetch(
    "https://apis.ihg.com/availability/v3/hotels/offers?fieldset=rateDetails,rateDetails.policies,rateDetails.bonusRates,alternatePayments",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-ihg-api-key": "se9ym5iAzaW8pxfBjkmgbuGjJcr3Pj6Y",
        "ihg-sessionid": randomUUID(),
        "ihg-transactionid": randomUUID(),
        "ihg-language": "en-GB",
        Origin: "https://www.ihg.com",
        Referer: "https://www.ihg.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: JSON.stringify({
        startDate: checkIn,
        endDate: checkOut,
        hotelMnemonics: [hotelCode],
        products: [
          {
            productCode: "SR",
            startDate: checkIn,
            endDate: checkOut,
            quantity: 1,
            guestCounts: [{ otaCode: "AQC10", count: 1 }],
          },
        ],
        options: {
          disabilityMode: "ACCESSIBLE_AND_NON_ACCESSIBLE",
          returnAdditionalRatePlanDescriptions: true,
          rateDetails: { includePackageDetails: true },
        },
      }),
    }
  );

  console.log("Status:", res.status);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
