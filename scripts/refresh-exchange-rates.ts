/**
 * Populates the ExchangeRate table with current rates from Frankfurter API.
 * Run locally with: npm run rates:refresh
 */
import { PrismaClient } from "@prisma/client";
import { CURRENCIES } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const nonUsdCurrencies = CURRENCIES.filter((c) => c !== "USD");

  console.log(`Fetching rates for ${nonUsdCurrencies.length} currencies from Frankfurter...`);

  let success = 0;
  let failed = 0;

  for (const currency of nonUsdCurrencies) {
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=USD`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { rates: { USD: number } };
      const rate = data.rates?.USD;
      if (typeof rate !== "number" || isNaN(rate)) throw new Error("Invalid rate");

      await prisma.exchangeRate.upsert({
        where: { fromCurrency_toCurrency: { fromCurrency: currency, toCurrency: "USD" } },
        update: { rate },
        create: { fromCurrency: currency, toCurrency: "USD", rate },
      });

      console.log(`  ${currency} → ${rate} USD`);
      success++;
    } catch (err) {
      console.error(`  ${currency} → ERROR: ${err}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
