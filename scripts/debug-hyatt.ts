import { HyattFetcher } from "../src/lib/scrapers/hyatt";
import { HOTEL_ID } from "../src/lib/constants";
import { FetchParams } from "../src/lib/price-fetcher";

async function debugHyattBrowser() {
  const fetcher = new HyattFetcher();
  const spiritCode = "kulzk"; // Hyatt Place KL Bukit Jalil

  const params: FetchParams = {
    property: {
      id: "test-id",
      name: "Hyatt Place KL Bukit Jalil",
      hotelChainId: HOTEL_ID.HYATT,
      chainPropertyId: spiritCode,
      displayName: "Hyatt Place KL Bukit Jalil",
      address: null,
      placeId: null,
      city: null,
      countryCode: null,
      latitude: null,
      longitude: null,
      subBrandId: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    checkIn: "2026-05-01",
    checkOut: "2026-05-02",
    adults: 1,
  };

  console.log(`--- DEBUG HYATT BROWSER ---`);
  console.log(`Property: ${params.property.displayName} (${spiritCode})`);
  console.log(`Dates: ${params.checkIn} to ${params.checkOut}`);

  const result = await fetcher.fetchPrice(params);

  if (result) {
    console.log("\n--- SUCCESS ---");
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("\n--- FAILED ---");
    console.log("Fetcher returned null.");
  }
}

debugHyattBrowser();
