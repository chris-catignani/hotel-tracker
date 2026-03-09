/**
 * Populates the ExchangeRate table with current rates from fawazahmed0/exchange-api.
 * Run locally with: npm run rates:refresh
 */
import { PrismaClient } from "@prisma/client";
import { CURRENCIES } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const nonUsdCurrencies = CURRENCIES.filter((c) => c !== "USD");

  console.log("Fetching all current rates from exchange-api...");

  // Fetch usd.json once — gives us 1 USD = X foreign for every currency
  const url =
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
  const fallback = "https://latest.currency-api.pages.dev/v1/currencies/usd.json";

  let res = await fetch(url);
  if (!res.ok) res = await fetch(fallback);
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = (await res.json()) as { usd: Record<string, number> };
  const rates = data.usd; // { eur: 0.915, twd: 31.6, ... }

  let success = 0;
  let skipped = 0;

  for (const currency of nonUsdCurrencies) {
    const usdPerForeign = rates[currency.toLowerCase()];
    if (typeof usdPerForeign !== "number" || isNaN(usdPerForeign) || usdPerForeign === 0) {
      console.warn(`  ${currency} → not found in API response, skipping`);
      skipped++;
      continue;
    }

    // Invert: 1 USD = X foreign → 1 foreign = 1/X USD
    const rate = 1 / usdPerForeign;

    await prisma.exchangeRate.upsert({
      where: { fromCurrency_toCurrency: { fromCurrency: currency, toCurrency: "USD" } },
      update: { rate },
      create: { fromCurrency: currency, toCurrency: "USD", rate },
    });

    console.log(`  ${currency} → ${rate.toFixed(6)} USD`);
    success++;
  }

  console.log(`\nDone. ${success} updated, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
