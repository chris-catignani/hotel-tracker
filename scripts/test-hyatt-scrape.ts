import { HyattFetcher } from "../src/lib/scrapers/hyatt/price-watch";

const TEST_PROPERTIES = [
  { spiritCode: "melct", name: "Melrose Georgetown" },
  { spiritCode: "melsx", name: "Andaz West Hollywood" },
  { spiritCode: "huahi", name: "Hyatt Regency Hua Hin" },
];

async function main() {
  const fetcher = new HyattFetcher();

  for (const { spiritCode, name } of TEST_PROPERTIES) {
    console.log(`\n=== Testing ${name} (${spiritCode}) ===`);
    try {
      const result = await fetcher.fetchPrice({
        property: {
          id: "test",
          name,
          hotelChainId: "HYATT",
          chainPropertyId: spiritCode,
          countryCode: null,
        },
        checkIn: "2026-06-01",
        checkOut: "2026-06-05",
      });

      if (!result) {
        console.log("❌ No result returned");
      } else {
        const cashRates = result.rates.filter((r) => r.cashPrice !== null);
        const awardRates = result.rates.filter((r) => r.awardPrice !== null);
        console.log(`✅ Cash rates: ${cashRates.length}, Award rates: ${awardRates.length}`);
        if (cashRates.length > 0) {
          const lowest = cashRates.reduce((a, b) => (a.cashPrice! < b.cashPrice! ? a : b));
          console.log(
            `   Lowest cash: $${lowest.cashPrice} ${lowest.cashCurrency} — ${lowest.roomName}`
          );
        }
        if (awardRates.length > 0) {
          const lowest = awardRates.reduce((a, b) => (a.awardPrice! < b.awardPrice! ? a : b));
          console.log(`   Lowest award: ${lowest.awardPrice} pts — ${lowest.roomName}`);
        }
      }
    } catch (err) {
      console.log(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Delay between properties
    if (spiritCode !== TEST_PROPERTIES[TEST_PROPERTIES.length - 1].spiritCode) {
      console.log("Waiting 5s before next property...");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main();
